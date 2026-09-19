import { Types } from "mongoose";
import { z } from "zod";
import PlanFeature from "../../models/PlanFeature.js";
import Plan from "../../models/Plan.js";
import AIAgent from "../../models/AIAgent.js";
import { quotaRegistry, isQuotaMetric } from "../../core/plans/quota.registry.js";
import { conflictError, forbiddenError, notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";

export const featureInputSchema = z.object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(80),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    quotas: z.record(z.string().refine(isQuotaMetric, "Unknown quota metric"), z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER)).default({}),
    agentSlugs: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
}).strict();

const authorize = (user: AuthenticatedUserContext) => {
    if (!user.permissions?.includes("plans.manage")) throw forbiddenError("Missing permission: plans.manage");
};
const find = async (id: string) => {
    if (!Types.ObjectId.isValid(id)) throw notFoundError("Feature not found.");
    const feature = await PlanFeature.findById(id);
    if (!feature) throw notFoundError("Feature not found.");
    return feature;
};
export const listBusinessFeatures = async (user: AuthenticatedUserContext) => {
    authorize(user);
    return PlanFeature.find().sort({ name: 1 }).lean().exec();
};
export const featureOptions = async (user: AuthenticatedUserContext) => {
    authorize(user);
    const agents = await AIAgent.aggregate([
        { $group: { _id: "$slug", name: { $first: "$name" } } },
        { $project: { _id: 0, slug: "$_id", name: 1 } },
        { $sort: { name: 1 } },
    ]);
    return { metrics: quotaRegistry.filter(metric => metric.unit !== "days"), agents };
};
export const saveBusinessFeature = async (user: AuthenticatedUserContext, input: unknown, id?: string) => {
    authorize(user);
    const parsed = featureInputSchema.safeParse(input);
    if (!parsed.success) throw unprocessableEntityError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    if (Object.keys(parsed.data.quotas).some(key => quotaRegistry.find(metric => metric.key === key)?.unit === "days")) {
        throw unprocessableEntityError("Duration limits are not available yet.");
    }
    const slugs = [...new Set(parsed.data.agentSlugs)];
    const known = await AIAgent.distinct("slug", { slug: { $in: slugs } });
    if (known.length !== slugs.length) throw unprocessableEntityError("Select existing agents only.");
    const feature = id ? await find(id) : new PlanFeature();
    if (id && feature.code !== parsed.data.code && await Plan.exists({ featureIds: id })) {
        throw conflictError("A feature used by a pricing plan cannot change its code.");
    }
    feature.set({ ...parsed.data, agentSlugs: slugs });
    try { await feature.save(); }
    catch (error) {
        if ((error as { code?: number }).code === 11000) throw conflictError("A feature with this code already exists.");
        throw error;
    }
    return feature.toObject();
};
export const deleteBusinessFeature = async (user: AuthenticatedUserContext, id: string) => {
    authorize(user);
    const feature = await find(id);
    if (await Plan.exists({ featureIds: id })) throw conflictError("Remove this feature from pricing plans before deleting it.");
    await feature.deleteOne();
    return { deleted: true };
};
