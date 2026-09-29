import Conversation from "../../models/Conversation.js";
import Workspace from "../../models/Workspace.js";
import { forbiddenError, notFoundError } from "../../core/shared/errors/HttpError.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";

const generateDateWindow = (days: number): string[] => {
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
};

const resolveWorkspaceSlug = async (
    user: AuthenticatedUserContext,
    requestedSlug?: string,
) => {
    if (!requestedSlug || requestedSlug === "all") {
        return undefined;
    }

    if (user.role === "super_admin") {
        const workspace = await Workspace.findOne({ slug: requestedSlug }).lean().exec();
        if (!workspace) throw notFoundError("Workspace not found");

        return workspace.slug;
    }

    const workspace = await Workspace.findOne({
        slug: requestedSlug,
        $or: [
            ...(user.workspaceId ? [{ _id: user.workspaceId }] : []),
            { ownerId: user.id },
        ],
    }).lean().exec();
    if (!workspace) throw notFoundError("Workspace not found");

    return workspace.slug;
};

export const getThreadAnalytics = async (
    user: AuthenticatedUserContext,
    requestedSlug?: string,
    days: number = 7,
) => {
    const systemSlug = await resolveWorkspaceSlug(user, requestedSlug);
    const conversationScope = systemSlug ? { systemSlug } : {};
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const matchScope = {
        ...conversationScope,
        createdAt: { $gte: startDate },
    };

    const [rawTimeSeries, totalInPeriod, activeInPeriod, endedInPeriod, hourlyAggregate] = await Promise.all([
        Conversation.aggregate([
            { $match: matchScope },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    total: { $sum: 1 },
                    open: {
                        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                    },
                    closed: {
                        $sum: { $cond: [{ $eq: ["$status", "ended"] }, 1, 0] },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        Conversation.countDocuments(matchScope),
        Conversation.countDocuments({ ...matchScope, status: "active" }),
        Conversation.countDocuments({ ...matchScope, status: "ended" }),
        Conversation.aggregate([
            { $match: matchScope },
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    const channelBreakdown: Array<{ name: string; count: number; sharePercent: number }> = [];
    const topicBreakdown: Array<{ topic: string; count: number; sharePercent: number }> = [];

    const totalCalculated = totalInPeriod;
    const automatedPercent = totalCalculated > 0 ? Math.round((endedInPeriod / totalCalculated) * 100) : 0;
    const openPercent = totalCalculated > 0 ? Math.round((activeInPeriod / totalCalculated) * 100) : 0;
    const escalatedPercent = totalCalculated > 0 ? Math.max(0, 100 - automatedPercent - openPercent) : 0;

    const hourlyMap = new Map<number, number>();
    for (const item of hourlyAggregate) {
        hourlyMap.set(item._id, item.count);
    }

    const targetHours = [0, 4, 8, 12, 16, 20];
    const hourlyActivity = targetHours.map((h) => {
        const label = `${String(h).padStart(2, "0")}:00`;
        const count = hourlyMap.get(h) || 0;
        return { hour: label, count };
    });

    const timeSeriesMap = new Map<string, { total: number; open: number; closed: number }>();
    for (const item of rawTimeSeries) {
        timeSeriesMap.set(item._id, {
            total: item.total,
            open: item.open,
            closed: item.closed,
        });
    }

    const fullDateWindow = generateDateWindow(days);
    const timeSeries = fullDateWindow.map((dateStr) => {
        const found = timeSeriesMap.get(dateStr);
        return {
            date: dateStr,
            total: found ? found.total : 0,
            open: found ? found.open : 0,
            closed: found ? found.closed : 0,
        };
    });

    return {
        workspace: systemSlug ?? "all",
        days,
        summary: {
            totalInPeriod,
            activeInPeriod,
            endedInPeriod,
            slaResponseSec: 0,
            csatScore: 0,
            aiResolutionPercent: automatedPercent,
        },
        time_series: timeSeries,
        channels: channelBreakdown,
        topics: topicBreakdown,
        resolution_split: [
            { label: "AI Automated", value: automatedPercent, color: "var(--primary)" },
            { label: "Escalated to Agent", value: escalatedPercent, color: "var(--warning)" },
            { label: "Pending Customer", value: openPercent, color: "var(--secondary)" },
        ],
        hourly_activity: hourlyActivity,
    };
};
