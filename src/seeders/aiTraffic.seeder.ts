import { AIAgent, AIModel, AIProvider, AIRequestLog, Workspace } from "../models/index.js";

export const seedAITraffic = async (slugs: string[], count = 10000, now = new Date()) => {
    if (!slugs.length || !Number.isInteger(count) || count < 1 || count > 100000) {
        throw new Error("Specify workspace slugs and 1–100000 records per workspace.");
    }
    const workspaces = await Workspace.find({ slug: { $in: slugs } }).lean();
    if (slugs.some(slug => !workspaces.some(workspace => workspace.slug === slug))) {
        throw new Error("One or more workspace slugs do not exist.");
    }
    const providers = await AIProvider.find().lean();
    const models = (await AIModel.find().lean()).flatMap(model => {
        const provider = providers.find(item => item._id.equals(model.providerId));
        return provider ? [{ model: model.externalId, provider: provider.code }] : [];
    });
    if (!models.length) throw new Error("Seed or configure models before seeding traffic.");
    const agents = await AIAgent.find({ workspaceId: { $in: workspaces.map(workspace => workspace._id) } }).lean();
    if (workspaces.some(workspace => !agents.some(agent => agent.workspaceId.equals(workspace._id)))) {
        throw new Error("Every selected workspace must already have agents.");
    }
    const result = [];
    for (const workspace of workspaces) {
        const fleet = agents.filter(agent => agent.workspaceId.equals(workspace._id));
        let inserted = 0;
        for (let offset = 0; offset < count; offset += 500) {
            const operations = Array.from({ length: Math.min(500, count - offset) }, (_, index) => {
                const i = offset + index;
                const engine = models[(i * 7 + Math.floor(i / 11)) % models.length];
                const status: "failed" | "fallback" | "success" = i % 23 === 0 ? "failed" : i % 9 === 0 ? "fallback" : "success";
                const promptTokens = 140 + (i * 131) % 7600;
                const completionTokens = status === "failed" ? 0 : 60 + (i * 73) % 2400;
                const createdAt = new Date(now.getTime() - Math.floor(Math.pow((i + 1) / (count + 1), 1.4) * 29.9 * 86400000));
                const correlationId = `demo-traffic-v1-${workspace._id}-${i}`;
                return { updateOne: {
                    filter: { correlationId, source: "demo" as const },
                    update: { $setOnInsert: {
                        workspaceId: workspace._id,
                        agentId: fleet[i % fleet.length]._id,
                        ...engine,
                        source: "demo" as const,
                        correlationId,
                        requestType: i % 3 === 0 ? "stream" as const : "generate" as const,
                        promptTokens, completionTokens,
                        totalTokens: promptTokens + completionTokens,
                        usageReported: true,
                        latencyMs: 220 + (i * 97) % 5600 + (status === "fallback" ? 2400 : 0),
                        status,
                        statusCode: status === "failed" ? (i % 2 ? 429 : 503) : 200,
                        errorCode: status === "failed" ? "SIMULATED_UPSTREAM_ERROR" : undefined,
                        errorMessage: status === "failed" ? "Synthetic demonstration failure; no provider request occurred." : undefined,
                        fallbackAttempts: status === "fallback" ? 1 + i % 2 : 0,
                        estimatedCostUsd: Number(((promptTokens + completionTokens) * 0.0000004).toFixed(6)),
                        createdAt, updatedAt: createdAt,
                    } },
                    upsert: true,
                    timestamps: false,
                } };
            });
            const batch = await AIRequestLog.bulkWrite(operations, { ordered: true });
            inserted += batch.upsertedCount;
        }
        result.push({ workspace: workspace.slug, requested: count, inserted });
    }
    return result;
};
