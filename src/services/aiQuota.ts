import { randomUUID } from "node:crypto";
import AIQuotaPolicy from "../models/AIQuotaPolicy.js";
import { createHttpError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";

export interface AIQuotaContext {
    workspaceId: string;
    agentId?: string;
    providerId?: string;
    modelId?: string;
}
export interface AIQuotaReservation {
    quotaId: string;
    leaseId: string;
    reservedTokens: number;
    resetAt: Date;
    windowId: string;
}

export const nextQuotaReset = (period: string, now: Date): Date => {
    const next = new Date(now);
    if (period === "minute") next.setUTCSeconds(60, 0);
    else if (period === "day") next.setUTCHours(24, 0, 0, 0);
    else if (period === "month") {
        next.setUTCMonth(next.getUTCMonth() + 1, 1);
        next.setUTCHours(0, 0, 0, 0);
    } else throw unprocessableEntityError("Unknown AI quota period.");
    return next;
};

export const settleAIQuotas = async (
    reservations: AIQuotaReservation[],
    actualTokens?: number,
    rollback = false,
): Promise<void> => {
    if (actualTokens !== undefined && (!Number.isSafeInteger(actualTokens) || actualTokens < 0)) {
        actualTokens = undefined;
    }
    for (const reservation of reservations) {
        // Usage belongs to its admission window. Releasing an old lease must not
        // subtract tokens from a newer window or from a second settlement.
        const difference = rollback ? -reservation.reservedTokens
            : actualTokens === undefined ? 0 : actualTokens - reservation.reservedTokens;
        const settled = await AIQuotaPolicy.updateOne({
            _id: reservation.quotaId,
            "leases.id": reservation.leaseId,
            windowId: reservation.windowId,
        }, {
            $inc: { usedTokens: difference, usedRequests: rollback ? -1 : 0 },
            $pull: { leases: { id: reservation.leaseId } },
        });
        if (!settled.matchedCount) {
            await AIQuotaPolicy.updateOne({ _id: reservation.quotaId }, {
                $pull: { leases: { id: reservation.leaseId } },
            });
        }
    }
};

export const reserveAIQuotas = async (
    context: AIQuotaContext,
    reservedTokens: number,
    timeoutMs: number,
): Promise<AIQuotaReservation[]> => {
    const scopes: Record<string, unknown>[] = [{ scope: "workspace" }];
    if (context.agentId) scopes.push({ scope: "agent", scopeId: context.agentId });
    if (context.providerId) scopes.push({ scope: "provider", scopeId: context.providerId });
    if (context.modelId) scopes.push({ scope: "model", scopeId: context.modelId });
    const quotas = await AIQuotaPolicy.find({
        workspaceId: context.workspaceId,
        enabled: true,
        $or: scopes,
    }).sort({ _id: 1 }).lean().exec();
    const reservations: AIQuotaReservation[] = [];
    try {
        for (const quota of quotas) {
            const now = new Date();
            const resetAt = nextQuotaReset(quota.period, now);
            await AIQuotaPolicy.updateOne({
                _id: quota._id,
                $or: [{ runtimeInitialized: { $ne: true } }, { resetAt: { $lte: now } }, { resetAt: null }],
            }, { $set: { usedRequests: 0, usedTokens: 0, resetAt, windowId: randomUUID(), runtimeInitialized: true } });
            await AIQuotaPolicy.updateOne({ _id: quota._id }, { $pull: { leases: { expiresAt: { $lte: now } } } });

            const leaseId = randomUUID();
            const admitted = await AIQuotaPolicy.findOneAndUpdate({
                _id: quota._id,
                enabled: true,
                $expr: { $and: [
                    { $or: [{ $eq: ["$requestLimit", 0] }, { $lt: ["$usedRequests", "$requestLimit"] }] },
                    { $or: [{ $eq: ["$tokenLimit", 0] }, { $lte: [{ $add: ["$usedTokens", reservedTokens] }, "$tokenLimit"] }] },
                    { $lt: [
                        { $size: { $filter: { input: { $ifNull: ["$leases", []] }, as: "lease", cond: { $gt: ["$$lease.expiresAt", now] } } } },
                        "$concurrencyLimit",
                    ] },
                ] },
            }, {
                $inc: { usedRequests: 1, usedTokens: reservedTokens },
                $push: { leases: { id: leaseId, expiresAt: new Date(now.getTime() + timeoutMs + 60000) } },
            }, { returnDocument: "after" }).lean().exec();
            if (!admitted) {
                throw createHttpError(429, `AI quota "${quota.name}" has no available request, token, or concurrency budget.`);
            }
            reservations.push({ quotaId: String(quota._id), leaseId, reservedTokens, resetAt: admitted.resetAt!, windowId: admitted.windowId! });
        }
        return reservations;
    } catch (error) {
        try {
            await settleAIQuotas(reservations, undefined, true);
        } catch {
            // Keep a conservative charge if storage fails during compensation.
            console.error("[AI quota] Could not roll back all reservations.");
        }
        throw error;
    }
};
