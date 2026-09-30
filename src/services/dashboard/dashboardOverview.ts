import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import Workspace from "../../models/Workspace.js";
import TokenLog from "../../models/TokenLog.js";
import Tag from "../../models/Tag.js";
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

export const getOverview = async (
    user: AuthenticatedUserContext,
    requestedSlug?: string,
) => {
    const systemSlug = await resolveWorkspaceSlug(user, requestedSlug);
    const conversationScope = systemSlug ? { systemSlug } : {};
    const recentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, active, ended, recent, conversations, tokenLogsCount, tagCount, hourlyAggregate, channelAggregate, topicAggregate, rawTimeSeries] = await Promise.all([
        Conversation.countDocuments(conversationScope),
        Conversation.countDocuments({ ...conversationScope, status: "active" }),
        Conversation.countDocuments({ ...conversationScope, status: "ended" }),
        Conversation.countDocuments({ ...conversationScope, createdAt: { $gte: recentSince } }),
        Conversation.find(conversationScope)
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean()
            .exec(),
        TokenLog.countDocuments(conversationScope),
        Tag.countDocuments(conversationScope),
        Conversation.aggregate([
            { $match: conversationScope },
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        Conversation.aggregate([
            { $match: { ...conversationScope, createdAt: { $gte: recentSince } } },
            { $group: { _id: { $ifNull: ["$receivedFrom", "web"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
        Conversation.aggregate([
            { $match: { ...conversationScope, createdAt: { $gte: recentSince } } },
            { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
            { $group: { _id: { $ifNull: ["$tags", "Uncategorized"] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
        ]),
        Conversation.aggregate([
            { $match: { ...conversationScope, createdAt: { $gte: recentSince } } },
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
    ]);

    const conversationIds = conversations.map((conversation) => conversation._id);
    const messageCount = conversationIds.length
        ? await Message.countDocuments({ conversationId: { $in: conversationIds } })
        : 0;

    const totalCalc = total;
    const endedPercent = totalCalc > 0 ? Math.round((ended / totalCalc) * 100) : 0;
    const aiResolutionPercent = endedPercent;
    const humanHandoffPercent = totalCalc > 0 ? Math.max(0, 100 - aiResolutionPercent) : 0;

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

    const fullDateWindow = generateDateWindow(7);
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
        stats: {
            total,
            open: active,
            pending: 0,
            closed: ended,
            unassigned: 0,
            recent,
            recent_message_count: messageCount,
            aiResolutionPercent,
            humanHandoffPercent,
            avgResponseSec: 0,
            csatScore: 0,
            ragAccuracyPercent: 0,
            leadsCaptured: 0,
            tokenRuns: tokenLogsCount,
            crmTags: tagCount,
        },
        time_series: timeSeries,
        channels: (() => { const totalMessages = channelAggregate.reduce((sum, item) => sum + item.count, 0); return channelAggregate.map((item) => ({ name: item._id || "web", count: item.count, sharePercent: totalMessages ? Math.round((item.count / totalMessages) * 100) : 0 })); })(),
        topics: (() => { const totalTopics = topicAggregate.reduce((sum, item) => sum + item.count, 0); return topicAggregate.map((item) => ({ topic: item._id || "Uncategorized", count: item.count, sharePercent: totalTopics ? Math.round((item.count / totalTopics) * 100) : 0 })); })(),
        hourly_activity: hourlyActivity,
        recent_threads: conversations.map((conversation) => ({
            id: conversation.publicId,
            user_name: conversation.visitor?.name || "Guest User",
            user_email: conversation.visitor?.email,
            user_phone: conversation.visitor?.phone,
            system_slug: conversation.systemSlug,
            status: conversation.status === "active" ? "open" : "closed",
            priority: (conversation as { priority?: string }).priority || "medium",
            assigned_agent: (conversation as { assignedAgent?: { name: string; email: string } }).assignedAgent,
            tags: (conversation as { tags?: string[] }).tags || [],
            notes: ((conversation as { notes?: Array<{ id: string; content: string; author: string; createdAt: Date }> }).notes || []).map((n) => ({
                id: n.id,
                content: n.content,
                author: n.author,
                created_at: n.createdAt,
            })),
            created_at: conversation.createdAt,
            updated_at: conversation.updatedAt,
        })),
    };
};
