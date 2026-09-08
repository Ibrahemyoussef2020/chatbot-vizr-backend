import { Types } from "mongoose";
import AIRoutingPolicy from "../models/AIRoutingPolicy.js";
import AIRequestLog from "../models/AIRequestLog.js";
import AIQuotaPolicy from "../models/AIQuotaPolicy.js";
import { conflictError } from "../core/shared/errors/HttpError.js";
import type { ExecutionModel } from "./aiExecution.js";

export const loadAIRoutingPolicy = async (workspaceId: string, agentId: string) => {
    const policies = await AIRoutingPolicy.find({
        workspaceId,
        enabled: true,
        $or: [{ agentId }, { agentId: null }],
    }).lean().exec();
    const specific = policies.filter(policy => String(policy.agentId) === agentId);
    const selected = specific.length ? specific : policies;
    if (selected.length > 1) {
        throw conflictError("Multiple active routing policies apply. Keep one active policy for this agent.");
    }
    return selected[0];
};

export const orderRoutingModels = async (
    models: ExecutionModel[],
    policy: { _id: unknown; strategy: string } | undefined,
    workspaceId: string,
): Promise<ExecutionModel[]> => {
    if (!policy || policy.strategy === "priority") return models;
    if (policy.strategy === "round_robin") {
        const sequence = await AIRoutingPolicy.findOneAndUpdate(
            { _id: policy._id },
            { $inc: { nextSequence: 1 } },
            { new: true },
        ).lean().exec();
        const start = ((sequence?.nextSequence ?? 1) - 1) % models.length;
        return [...models.slice(start), ...models.slice(0, start)];
    }
    if (policy.strategy === "quota_aware") {
        const quotas = await AIQuotaPolicy.find({ workspaceId, enabled: true }).lean().exec();
        const pressure = (model: ExecutionModel) => {
            const matching = quotas.filter(quota =>
                (quota.scope === "provider" && String(quota.scopeId) === model.providerId)
                || (quota.scope === "model" && String(quota.scopeId) === model.id),
            );
            return Math.max(0, ...matching.map(quota => {
                if (!quota.runtimeInitialized) return 0;
                if (quota.resetAt && quota.resetAt <= new Date()) return 0;
                return Math.max(
                    quota.requestLimit ? quota.usedRequests / quota.requestLimit : 0,
                    quota.tokenLimit ? quota.usedTokens / quota.tokenLimit : 0,
                    (quota.leases ?? []).filter(lease => lease.expiresAt > new Date()).length / Math.max(1, quota.concurrencyLimit),
                );
            }));
        };
        return [...models].sort((left, right) => pressure(left) - pressure(right));
    }
    const metrics = await AIRequestLog.aggregate<{
        _id: { provider: string; model: string };
        requests: number;
        latency: number;
    }>([
        { $match: {
            workspaceId: new Types.ObjectId(workspaceId),
            source: "runtime",
            createdAt: { $gte: new Date(Date.now() - 86400000) },
        } },
        { $group: {
            _id: { provider: "$provider", model: "$model" },
            requests: { $sum: 1 },
            latency: { $avg: "$latencyMs" },
        } },
    ]);
    const score = (model: ExecutionModel) => {
        const metric = metrics.find(item => item._id.provider === model.provider && item._id.model === model.externalId);
        if (policy.strategy === "least_used") return metric?.requests ?? 0;
        // Unmeasured candidates are tried first to obtain a real latency sample.
        return metric?.latency ?? 0;
    };
    return [...models].sort((left, right) => score(left) - score(right));
};
