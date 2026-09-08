import { Types } from "mongoose";
import {
    AIAgent,
    AIModel,
    AIProvider,
    AIQuotaPolicy,
    AIRequestLog,
    AIRoutingPolicy,
    SecurityRole,
    Workspace,
} from "../models/index.js";
import {
    forbiddenError,
    notFoundError,
    unprocessableEntityError,
} from "../core/shared/errors/HttpError.js";
import {
    hasProviderCredentials,
    providerDefinitions,
} from "../core/ai-management/provider.registry.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { agentInputSchema, modelInputSchema, routingInputSchema, quotaInputSchema, parseAIInput } from "./aiManagementValidation.js";
import { conflictError } from "../core/shared/errors/HttpError.js";

export const resolveWorkspace = async (
    user: AuthenticatedUserContext,
    slug?: string,
) => {
    const workspace = slug
        ? await Workspace.findOne({ slug: slug.toLowerCase() })
        : await Workspace.findById(user.workspaceId);

    if (!workspace) {
        throw notFoundError("Workspace not found.");
    }

    const belongsToUser = String(workspace._id) === user.workspaceId;
    if (user.role !== "super_admin" && !belongsToUser) {
        throw forbiddenError("Workspace access denied.");
    }

    return workspace;
};

const ensureProviders = async () => {
    return Promise.all(
        providerDefinitions.map((definition) =>
            AIProvider.findOneAndUpdate(
                { code: definition.code },
                {
                    $setOnInsert: {
                        ...definition,
                        enabled: true,
                        priority: 100,
                    },
                },
                { upsert: true, new: true },
            ),
        ),
    );
};

const toProviderView = (provider: any) => {
    const definition = providerDefinitions.find(
        (item) => item.code === provider.code,
    );

    return {
        id: String(provider._id),
        code: provider.code,
        name: provider.name,
        enabled: provider.enabled,
        priority: provider.priority,
        base_url: provider.baseUrl,
        configured: definition
            ? hasProviderCredentials(definition)
            : false,
        health: provider.health,
        last_checked_at: provider.lastCheckedAt,
        last_error: provider.lastError || "",
    };
};

export const getAIOverviewService = async (
    user: AuthenticatedUserContext,
    slug?: string,
    source: "runtime" | "demo" = "runtime",
) => {
    const workspace = await resolveWorkspace(user, slug);
    await ensureProviders();

    const scope = { workspaceId: workspace._id };
    const runtimeScope = { ...scope, source };
    const [providers, models, agents, requests, successful, failed, usage] =
        await Promise.all([
            AIProvider.countDocuments({ enabled: true }),
            AIModel.countDocuments({ enabled: true }),
            AIAgent.countDocuments({ ...scope, enabled: true }),
            AIRequestLog.countDocuments(runtimeScope),
            AIRequestLog.countDocuments({
                ...runtimeScope,
                status: { $in: ["success", "fallback"] },
            }),
            AIRequestLog.countDocuments({ ...runtimeScope, status: "failed" }),
            AIRequestLog.aggregate([
                { $match: runtimeScope },
                {
                    $group: {
                        _id: null,
                        tokens: { $sum: "$totalTokens" },
                        latency: { $avg: "$latencyMs" },
                        fallbacks: { $sum: "$fallbackAttempts" },
                    },
                },
            ]),
        ]);

    const usageMetrics = usage[0] || {};

    return {
        providers,
        models,
        agents,
        requests,
        successful,
        failed,
        success_rate: requests
            ? Math.round((successful / requests) * 1000) / 10
            : 0,
        total_tokens: usageMetrics.tokens || 0,
        average_latency_ms: Math.round(usageMetrics.latency || 0),
        fallback_attempts: usageMetrics.fallbacks || 0,
    };
};

export const listAIProvidersService = async () => {
    const providers = await ensureProviders();

    return providers
        .sort((first, second) => first.priority - second.priority)
        .map(toProviderView);
};

const assertGlobalAIManagement = (user: AuthenticatedUserContext, permission: string) => {
    if (!user.permissions?.includes("business.manage") || !user.permissions.includes(permission)) {
        throw forbiddenError("Global AI connections and models require business administration permission.");
    }
};

export const updateAIProviderService = async (id: string, input: any, user: AuthenticatedUserContext) => {
    assertGlobalAIManagement(user, "ai.providers.manage");
    const changes: Record<string, boolean | number> = {};

    if (!Types.ObjectId.isValid(id)) {
        throw unprocessableEntityError("A valid provider ID is required.");
    }

    if (input.enabled !== undefined) {
        if (typeof input.enabled !== "boolean") {
            throw unprocessableEntityError("Enabled must be true or false.");
        }
        changes.enabled = input.enabled;
    }

    if (input.priority !== undefined) {
        if (!Number.isSafeInteger(input.priority) || input.priority < 0) {
            throw unprocessableEntityError("Priority must be a nonnegative integer.");
        }
        changes.priority = input.priority;
    }

    const provider = await AIProvider.findByIdAndUpdate(id, changes, {
        new: true,
        runValidators: true,
    });

    if (!provider) {
        throw notFoundError("AI provider not found.");
    }

    return toProviderView(provider);
};

export const listAIModelsService = async () => {
    return AIModel.find()
        .populate("providerId", "code name health")
        .sort({ priority: 1, displayName: 1 })
        .lean();
};

export const saveAIModelService = async (user: AuthenticatedUserContext, input: any, id?: string) => {
    assertGlobalAIManagement(user, "ai.models.manage");
    const previous = id ? await AIModel.findById(id).lean() : undefined;
    if (id && !previous) {
        throw notFoundError("AI model not found.");
    }
    input = parseAIInput(modelInputSchema, {
        ...previous,
        ...(previous && { providerId: String(previous.providerId) }),
        ...input,
    });
    if (!Types.ObjectId.isValid(input.providerId)) {
        throw unprocessableEntityError("A valid provider is required.");
    }

    const providerExists = await AIProvider.exists({ _id: input.providerId });
    if (!providerExists) {
        throw unprocessableEntityError("AI provider not found.");
    }

    const values = { ...input };
    delete values.id;

    if (!id) {
        return AIModel.create(values);
    }

    const model = await AIModel.findByIdAndUpdate(id, values, {
        new: true,
        runValidators: true,
    });

    if (!model) {
        throw notFoundError("AI model not found.");
    }

    return model;
};

export const deleteAIModelService = async (id: string, user: AuthenticatedUserContext) => {
    assertGlobalAIManagement(user, "ai.models.manage");
    const [agent, routing] = await Promise.all([
        AIAgent.exists({ $or: [{ primaryModelId: id }, { fallbackModelIds: id }] }),
        AIRoutingPolicy.exists({ modelIds: id }),
    ]);
    if (agent || routing) {
        throw conflictError("Remove this model from agents and routing policies before deleting it.");
    }
    const model = await AIModel.findByIdAndDelete(id);

    if (!model) {
        throw notFoundError("AI model not found.");
    }

    return { id, deleted: true };
};

export const listAIAgentsService = async (
    user: AuthenticatedUserContext,
    slug?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);

    return AIAgent.find({ workspaceId: workspace._id })
        .populate("securityRoleId", "name code permissions")
        .populate("primaryModelId", "displayName externalId")
        .sort({ name: 1 })
        .lean();
};

export const saveAIAgentService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    input: any,
    id?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);

    const previous = id
        ? await AIAgent.findOne({ _id: id, workspaceId: workspace._id }).lean()
        : undefined;
    if (id && !previous) {
        throw notFoundError("AI agent not found.");
    }
    input = parseAIInput(agentInputSchema, {
        ...previous,
        ...(previous && {
            securityRoleId: String(previous.securityRoleId),
            primaryModelId: String(previous.primaryModelId),
            fallbackModelIds: previous.fallbackModelIds.map(String),
        }),
        ...input,
        slug: input.slug ?? previous?.slug ?? input.name,
    });
    const modelIds = [...new Set([input.primaryModelId, ...input.fallbackModelIds])];
    const modelCount = await AIModel.countDocuments({ _id: { $in: modelIds } });
    if (modelCount !== modelIds.length) {
        throw unprocessableEntityError("One or more assigned models do not exist.");
    }

    if (!Types.ObjectId.isValid(input.securityRoleId)) {
        throw unprocessableEntityError(
            "A valid shared security role is required.",
        );
    }

    const role = await SecurityRole.findOne({
        _id: input.securityRoleId,
        scope: "workspace",
        $or: [{ workspaceId: workspace._id }, { workspaceId: null }],
    });

    if (!role) {
        throw unprocessableEntityError(
            "Security role is not available to this workspace.",
        );
    }

    const values = {
        ...input,
        workspaceId: workspace._id,
        slug: String(input.slug || input.name)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
    };

    delete values.id;
    delete values.system_slug;

    if (!id) {
        return AIAgent.create(values);
    }

    const agent = await AIAgent.findOneAndUpdate(
        { _id: id, workspaceId: workspace._id },
        values,
        { new: true, runValidators: true },
    );

    if (!agent) {
        throw notFoundError("AI agent not found.");
    }

    return agent;
};

export const deleteAIAgentService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    id: string,
) => {
    const workspace = await resolveWorkspace(user, slug);
    if (String(workspace.defaultAiAgentId) === id) {
        throw conflictError("Assign another default agent or select environment defaults before deleting this agent.");
    }
    const agent = await AIAgent.findOneAndDelete({
        _id: id,
        workspaceId: workspace._id,
    });

    if (!agent) {
        throw notFoundError("AI agent not found.");
    }

    return { id, deleted: true };
};

export const getAIRuntimeService = async (user: AuthenticatedUserContext, slug?: string) => {
    const workspace = await resolveWorkspace(user, slug);
    const roles = await SecurityRole.find({
        scope: "workspace",
        $or: [{ workspaceId: workspace._id }, { workspaceId: null }],
    }).select("name code permissions").sort({ name: 1 }).lean();
    return { defaultAgentId: workspace.defaultAiAgentId ?? null, roles, permissions: user.permissions ?? [] };
};

export const saveAIRuntimeService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    input: { defaultAgentId?: unknown },
) => {
    const workspace = await resolveWorkspace(user, slug);
    const id = input.defaultAgentId;
    if (id !== null) {
        if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
            throw unprocessableEntityError("Choose a valid agent or explicitly select environment defaults.");
        }
        const agent = await AIAgent.exists({ _id: id, workspaceId: workspace._id, enabled: true });
        if (!agent) {
            throw unprocessableEntityError("Choose an enabled agent in this workspace.");
        }
    }
    workspace.defaultAiAgentId = id === null ? null : new Types.ObjectId(id as string);
    await workspace.save();
    return { defaultAgentId: workspace.defaultAiAgentId };
};

export const listAIRequestLogsService = async (
    user: AuthenticatedUserContext,
    slug?: string,
    source: "runtime" | "demo" = "runtime",
) => {
    const workspace = await resolveWorkspace(user, slug);

    return AIRequestLog.find({ workspaceId: workspace._id, source })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
};

export const listAIRoutingService = async (
    user: AuthenticatedUserContext,
    slug?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);

    return AIRoutingPolicy.find({ workspaceId: workspace._id })
        .populate("agentId", "name slug")
        .populate("modelIds", "displayName externalId")
        .sort({ name: 1 })
        .lean();
};

export const saveAIRoutingService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    input: any,
    id?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);
    const previous = id ? await AIRoutingPolicy.findOne({ _id: id, workspaceId: workspace._id }).lean() : undefined;
    if (id && !previous) throw notFoundError("Routing policy not found.");
    input = parseAIInput(routingInputSchema, {
        ...previous,
        ...(previous && { agentId: previous.agentId ? String(previous.agentId) : null, modelIds: previous.modelIds.map(String) }),
        ...input,
    });
    if (input.agentId && !await AIAgent.exists({ _id: input.agentId, workspaceId: workspace._id })) {
        throw unprocessableEntityError("Routing agent is not in this workspace.");
    }
    if (input.enabled && await AIRoutingPolicy.exists({
        workspaceId: workspace._id,
        agentId: input.agentId ?? null,
        enabled: true,
        ...(id && { _id: { $ne: id } }),
    })) {
        throw conflictError("Disable the existing routing policy for this agent before enabling another.");
    }
    const suppliedModelIds = Array.isArray(input.modelIds)
        ? input.modelIds.map(String)
        : [];

    const hasInvalidModelId = suppliedModelIds.some(
        (modelId: string) => !Types.ObjectId.isValid(modelId),
    );

    if (!suppliedModelIds.length || hasInvalidModelId) {
        throw unprocessableEntityError(
            "Select at least one valid routing model.",
        );
    }

    const uniqueModelIds = [...new Set(suppliedModelIds)];
    const existingModelCount = await AIModel.countDocuments({
        _id: { $in: uniqueModelIds },
    });

    if (existingModelCount !== uniqueModelIds.length) {
        throw unprocessableEntityError(
            "One or more routing models do not exist.",
        );
    }

    const values = {
        ...input,
        modelIds: uniqueModelIds,
        workspaceId: workspace._id,
    };

    delete values.id;
    delete values.system_slug;

    if (!id) {
        return AIRoutingPolicy.create(values);
    }

    const policy = await AIRoutingPolicy.findOneAndUpdate(
        { _id: id, workspaceId: workspace._id },
        values,
        { new: true, runValidators: true },
    );

    if (!policy) {
        throw notFoundError("Routing policy not found.");
    }

    return policy;
};

export const deleteAIRoutingService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    id: string,
) => {
    const workspace = await resolveWorkspace(user, slug);
    const policy = await AIRoutingPolicy.findOneAndDelete({
        _id: id,
        workspaceId: workspace._id,
    });

    if (!policy) {
        throw notFoundError("Routing policy not found.");
    }

    return { id, deleted: true };
};

export const listAIQuotasService = async (
    user: AuthenticatedUserContext,
    slug?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);

    const quotas = await AIQuotaPolicy.find({ workspaceId: workspace._id })
        .sort({ scope: 1, name: 1 })
        .lean();
    const now = new Date();
    return quotas.map(({ leases, ...quota }) => ({
        ...quota,
        usedRequests: quota.runtimeInitialized && quota.resetAt && quota.resetAt > now ? quota.usedRequests : 0,
        usedTokens: quota.runtimeInitialized && quota.resetAt && quota.resetAt > now ? quota.usedTokens : 0,
        activeRequests: (leases ?? []).filter(lease => lease.expiresAt > now).length,
    }));
};

export const saveAIQuotaService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    input: any,
    id?: string,
) => {
    const workspace = await resolveWorkspace(user, slug);
    const previous = id ? await AIQuotaPolicy.findOne({ _id: id, workspaceId: workspace._id }).lean() : undefined;
    if (id && !previous) throw notFoundError("Quota policy not found.");
    input = parseAIInput(quotaInputSchema, {
        ...previous,
        ...(previous && { scopeId: previous.scopeId ? String(previous.scopeId) : null }),
        ...input,
    });
    if (input.scope === "workspace") input.scopeId = null;
    const targetExists = input.scope === "workspace" ? true
        : input.scope === "agent" ? await AIAgent.exists({ _id: input.scopeId, workspaceId: workspace._id })
        : input.scope === "provider" ? await AIProvider.exists({ _id: input.scopeId })
        : await AIModel.exists({ _id: input.scopeId });
    if (!targetExists) {
        throw unprocessableEntityError("Quota target is missing or outside this workspace.");
    }
    if (previous?.runtimeInitialized && (previous.period !== input.period || previous.scope !== input.scope || String(previous.scopeId ?? "") !== String(input.scopeId ?? ""))) {
        throw conflictError("An active usage history cannot change scope or period. Create a new policy for the new scope or period.");
    }
    const values = { ...input, workspaceId: workspace._id };

    delete values.id;
    delete values.system_slug;
    delete values.usedRequests;
    delete values.usedTokens;

    if (!id) {
        return AIQuotaPolicy.create(values);
    }

    const quota = await AIQuotaPolicy.findOneAndUpdate(
        { _id: id, workspaceId: workspace._id },
        values,
        { new: true, runValidators: true },
    );

    if (!quota) {
        throw notFoundError("Quota policy not found.");
    }

    return quota;
};

export const deleteAIQuotaService = async (
    user: AuthenticatedUserContext,
    slug: string | undefined,
    id: string,
) => {
    const workspace = await resolveWorkspace(user, slug);
    const quota = await AIQuotaPolicy.findOneAndDelete({
        _id: id,
        workspaceId: workspace._id,
    });

    if (!quota) {
        throw notFoundError("Quota policy not found.");
    }

    return { id, deleted: true };
};

export const getAIAnalyticsService = async (
    user: AuthenticatedUserContext,
    slug?: string,
    source: "runtime" | "demo" = "runtime",
) => {
    const workspace = await resolveWorkspace(user, slug);
    const match = { workspaceId: workspace._id, source, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } };

    const [providers, daily, statuses] = await Promise.all([
        AIRequestLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$provider",
                    requests: { $sum: 1 },
                    tokens: { $sum: "$totalTokens" },
                    avgLatencyMs: { $avg: "$latencyMs" },
                    costUsd: { $sum: "$estimatedCostUsd" },
                },
            },
            { $sort: { requests: -1 } },
        ]),
        AIRequestLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                        },
                    },
                    requests: { $sum: 1 },
                    tokens: { $sum: "$totalTokens" },
                    failures: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "failed"] },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        AIRequestLog.aggregate([
            { $match: match },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
    ]);

    return { providers, daily, statuses };
};
