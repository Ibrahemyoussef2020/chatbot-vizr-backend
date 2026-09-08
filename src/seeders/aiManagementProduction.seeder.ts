import { AIAgent, AIModel, AIProvider, AIQuotaPolicy, AIRoutingPolicy, SecurityRole, Workspace } from "../models/index.js";
import { providerDefinitions } from "../core/ai-management/provider.registry.js";

const templates = [
    ["Customer Support", "customer-support", "Answer customer questions accurately using approved knowledge. Ask for clarification when needed."],
    ["Sales Concierge", "sales-concierge", "Explain products and plans using approved information. Never invent prices or availability."],
    ["Knowledge Analyst", "knowledge-analyst", "Analyze approved sources, cite evidence and clearly identify missing information."],
    ["Business Planner", "business-planner", "Draft practical plans with milestones, assumptions and risks. Do not claim to execute actions."],
    ["Quality Reviewer", "quality-reviewer", "Review responses for accuracy, tone and compliance with the supplied instructions."],
    ["Fallback Assistant", "fallback-assistant", "Provide concise help. Explain uncertainty and suggest human assistance when needed."],
] as const;

// Insert-only updates also disable timestamps so reruns leave existing records untouched.
const insertOptions = { upsert: true, new: true, timestamps: false } as const;
const dated = (values: Record<string, unknown>) => ({
    ...values,
    createdAt: new Date(),
    updatedAt: new Date(),
});

export const seedProductionAIManagement = async (
    slugs: string[],
    modelConfig?: { provider: string; model: string },
) => {
    if (!slugs.length) throw new Error("At least one workspace slug is required.");
    const workspaces = await Workspace.find({ slug: { $in: slugs } });
    const missing = slugs.filter(slug => !workspaces.some(workspace => workspace.slug === slug));
    if (missing.length) throw new Error(`Unknown workspaces: ${missing.join(", ")}`);
    if (modelConfig && !providerDefinitions.some(item => item.code === modelConfig.provider)) {
        throw new Error("Unknown model provider.");
    }

    for (const definition of providerDefinitions) {
        await AIProvider.findOneAndUpdate(
            { code: definition.code },
            { $setOnInsert: dated({ ...definition, enabled: true, health: "unknown", priority: 100 }) },
            insertOptions,
        );
    }

    let modelId;
    if (modelConfig) {
        const provider = await AIProvider.findOne({ code: modelConfig.provider }).orFail();
        const model = await AIModel.findOneAndUpdate(
            { providerId: provider._id, externalId: modelConfig.model },
            { $setOnInsert: dated({ displayName: modelConfig.model, enabled: true }) },
            insertOptions,
        );
        modelId = model._id;
    }

    for (const workspace of workspaces) {
        const role = await SecurityRole.findOneAndUpdate(
            { workspaceId: workspace._id, code: "ai_starter" },
            { $setOnInsert: dated({ name: "AI Starter", scope: "workspace", permissions: [], isSystem: false }) },
            insertOptions,
        );
        for (const [name, slug, systemPrompt] of templates) {
            const agent = await AIAgent.findOneAndUpdate(
                { workspaceId: workspace._id, slug },
                { $setOnInsert: dated({
                    name, systemPrompt, description: "Starter template. Review model, permissions and tools before enabling.",
                    securityRoleId: role._id, primaryModelId: modelId,
                    enabled: false, tools: [], channels: [], fallbackModelIds: [],
                    temperature: 0.35, maxOutputTokens: 1200, timeoutMs: 45000,
                }) },
                insertOptions,
            );
            await AIRoutingPolicy.findOneAndUpdate(
                { workspaceId: workspace._id, name: `${name} Routing` },
                { $setOnInsert: dated({
                    agentId: agent._id, strategy: "priority", enabled: false,
                    modelIds: agent.primaryModelId ? [agent.primaryModelId] : [],
                    maxRetries: 0, timeoutMs: 45000,
                }) },
                insertOptions,
            );
        }
        await AIQuotaPolicy.findOneAndUpdate(
            { workspaceId: workspace._id, name: "Starter Daily Budget" },
            { $setOnInsert: dated({
                scope: "workspace", period: "day", enabled: false,
                requestLimit: 1000, tokenLimit: 1000000, concurrencyLimit: 5,
                usedRequests: 0, usedTokens: 0, runtimeInitialized: false,
            }) },
            insertOptions,
        );
    }
    return { workspaces: workspaces.map(workspace => workspace.slug), templatesPerWorkspace: templates.length };
};
