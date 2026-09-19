import { z } from "zod";
import Subscription from "../../models/Subscription.js";
import "../../models/Workspace.js";
import "../../models/Plan.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { authorizeBusinessPayment } from "./authorization.js";
import { unprocessableEntityError } from "../../core/shared/errors/HttpError.js";

const filters = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["all", "trialing", "active", "past_due", "canceled", "expired"]).default("all"),
    search: z.string().trim().max(120).default(""),
});

export const listBusinessSubscriptions = async (user: AuthenticatedUserContext, input: unknown) => {
    authorizeBusinessPayment(user, "subscriptions.view");
    const parsed = filters.safeParse(input);
    if (!parsed.success) throw unprocessableEntityError("Invalid subscription filters.");
    const { page, limit, status, search } = parsed.data;
    const query: Record<string, unknown> = {};
    if (status !== "all") query.status = status;
    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.planCode = new RegExp(escaped, "i");
    }
    const [items, total] = await Promise.all([
        Subscription.find(query).select("workspaceId planId planCode status billingCycle currentPeriodStart currentPeriodEnd provider cancelAtPeriodEnd canceledAt createdAt")
            .populate("workspaceId", "name slug").populate("planId", "name currency pricing")
            .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
        Subscription.countDocuments(query),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
};
