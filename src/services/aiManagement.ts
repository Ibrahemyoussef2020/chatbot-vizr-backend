import { Types } from "mongoose";
import { AIAgent, AIModel, AIProvider, AIQuotaPolicy, AIRequestLog, AIRoutingPolicy, SecurityRole, Workspace } from "../models/index.js";
import { forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { hasProviderCredentials, providerDefinitions } from "../core/ai-management/provider.registry.js";
import type { AuthenticatedUserContext } from "./workspaces.js";

const resolveWorkspace = async (user: AuthenticatedUserContext, slug?: string) => {
    const workspace = slug ? await Workspace.findOne({ slug: slug.toLowerCase() }) : await Workspace.findById(user.workspaceId);
    if (!workspace) throw notFoundError("Workspace not found.");
    if (user.role !== "super_admin" && String(workspace._id) !== user.workspaceId) throw forbiddenError("Workspace access denied.");
    return workspace;
};
const ensureProviders = async () => Promise.all(providerDefinitions.map((d) => AIProvider.findOneAndUpdate({ code: d.code }, { $setOnInsert: { ...d, enabled: true, priority: 100 } }, { upsert: true, new: true })));
const providerView = (p: any) => { const d = providerDefinitions.find((x) => x.code === p.code); return { id: String(p._id), code: p.code, name: p.name, enabled: p.enabled, priority: p.priority, base_url: p.baseUrl, configured: d ? hasProviderCredentials(d) : false, health: p.health, last_checked_at: p.lastCheckedAt, last_error: p.lastError || "" }; };

export const getAIOverviewService = async (user: AuthenticatedUserContext, slug?: string) => {
    const ws = await resolveWorkspace(user, slug); await ensureProviders(); const scope = { workspaceId: ws._id };
    const [providers, models, agents, requests, successful, failed, usage] = await Promise.all([AIProvider.countDocuments({ enabled: true }), AIModel.countDocuments({ enabled: true }), AIAgent.countDocuments({ ...scope, enabled: true }), AIRequestLog.countDocuments(scope), AIRequestLog.countDocuments({ ...scope, status: { $in: ["success", "fallback"] } }), AIRequestLog.countDocuments({ ...scope, status: "failed" }), AIRequestLog.aggregate([{ $match: scope }, { $group: { _id: null, tokens: { $sum: "$totalTokens" }, latency: { $avg: "$latencyMs" }, fallbacks: { $sum: "$fallbackAttempts" } } }])]);
    const m = usage[0] || {}; return { providers, models, agents, requests, successful, failed, success_rate: requests ? Math.round(successful / requests * 1000) / 10 : 0, total_tokens: m.tokens || 0, average_latency_ms: Math.round(m.latency || 0), fallback_attempts: m.fallbacks || 0 };
};
export const listAIProvidersService = async () => (await ensureProviders()).sort((a, b) => a.priority - b.priority).map(providerView);
export const updateAIProviderService = async (id: string, input: any) => { const changes: any = {}; if (input.enabled !== undefined) changes.enabled = Boolean(input.enabled); if (input.priority !== undefined) changes.priority = Number(input.priority); const p = await AIProvider.findByIdAndUpdate(id, changes, { new: true, runValidators: true }); if (!p) throw notFoundError("AI provider not found."); return providerView(p); };
export const listAIModelsService = async () => AIModel.find().populate("providerId", "code name health").sort({ priority: 1, displayName: 1 }).lean();
export const saveAIModelService = async (input: any, id?: string) => {
    if (!Types.ObjectId.isValid(input.providerId)) throw unprocessableEntityError("A valid provider is required.");
    const provider = await AIProvider.findById(input.providerId); if (!provider) throw unprocessableEntityError("AI provider not found.");
    const values = { ...input }; delete values.id;
    if (!id) return AIModel.create(values);
    const model = await AIModel.findByIdAndUpdate(id, values, { new: true, runValidators: true }); if (!model) throw notFoundError("AI model not found."); return model;
};
export const deleteAIModelService = async (id: string) => { const model = await AIModel.findByIdAndDelete(id); if (!model) throw notFoundError("AI model not found."); return { id, deleted: true }; };
export const listAIAgentsService = async (user: AuthenticatedUserContext, slug?: string) => { const ws = await resolveWorkspace(user, slug); return AIAgent.find({ workspaceId: ws._id }).populate("securityRoleId", "name code permissions").populate("primaryModelId", "displayName externalId").sort({ name: 1 }).lean(); };
export const saveAIAgentService = async (user: AuthenticatedUserContext, slug: string | undefined, input: any, id?: string) => {
    const ws = await resolveWorkspace(user, slug); if (!Types.ObjectId.isValid(input.securityRoleId)) throw unprocessableEntityError("A valid shared security role is required.");
    const role = await SecurityRole.findOne({ _id: input.securityRoleId, $or: [{ workspaceId: ws._id }, { workspaceId: null }] }); if (!role) throw unprocessableEntityError("Security role is not available to this workspace.");
    const values: any = { ...input, workspaceId: ws._id, slug: String(input.slug || input.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }; delete values.id; delete values.system_slug;
    if (!id) return AIAgent.create(values); const agent = await AIAgent.findOneAndUpdate({ _id: id, workspaceId: ws._id }, values, { new: true, runValidators: true }); if (!agent) throw notFoundError("AI agent not found."); return agent;
};
export const deleteAIAgentService = async (user: AuthenticatedUserContext, slug: string | undefined, id: string) => { const ws = await resolveWorkspace(user, slug); const agent = await AIAgent.findOneAndDelete({ _id: id, workspaceId: ws._id }); if (!agent) throw notFoundError("AI agent not found."); return { id, deleted: true }; };
export const listAIRequestLogsService = async (user: AuthenticatedUserContext, slug?: string) => { const ws = await resolveWorkspace(user, slug); return AIRequestLog.find({ workspaceId: ws._id }).sort({ createdAt: -1 }).limit(200).lean(); };
export const listAIRoutingService = async (user: AuthenticatedUserContext, slug?: string) => { const ws = await resolveWorkspace(user, slug); return AIRoutingPolicy.find({ workspaceId: ws._id }).populate("agentId", "name slug").populate("modelIds", "displayName externalId").sort({ name: 1 }).lean(); };
export const listAIQuotasService = async (user: AuthenticatedUserContext, slug?: string) => { const ws = await resolveWorkspace(user, slug); return AIQuotaPolicy.find({ workspaceId: ws._id }).sort({ scope: 1, name: 1 }).lean(); };
export const saveAIRoutingService = async (user: AuthenticatedUserContext, slug: string | undefined, input: any, id?: string) => { const ws = await resolveWorkspace(user, slug); if (!Array.isArray(input.modelIds) || !input.modelIds.length || input.modelIds.some((modelId: string) => !Types.ObjectId.isValid(modelId))) throw unprocessableEntityError("Select at least one valid routing model."); const modelCount = await AIModel.countDocuments({ _id: { $in: input.modelIds } }); if (modelCount !== new Set(input.modelIds.map(String)).size) throw unprocessableEntityError("One or more routing models do not exist."); const values = { ...input, modelIds: [...new Set(input.modelIds.map(String))], workspaceId: ws._id }; delete values.id; delete values.system_slug; if (!id) return AIRoutingPolicy.create(values); const policy = await AIRoutingPolicy.findOneAndUpdate({ _id: id, workspaceId: ws._id }, values, { new: true, runValidators: true }); if (!policy) throw notFoundError("Routing policy not found."); return policy; };
export const deleteAIRoutingService = async (user: AuthenticatedUserContext, slug: string | undefined, id: string) => { const ws = await resolveWorkspace(user, slug); const policy = await AIRoutingPolicy.findOneAndDelete({ _id: id, workspaceId: ws._id }); if (!policy) throw notFoundError("Routing policy not found."); return { id, deleted: true }; };
export const saveAIQuotaService = async (user: AuthenticatedUserContext, slug: string | undefined, input: any, id?: string) => { const ws = await resolveWorkspace(user, slug); const values = { ...input, workspaceId: ws._id }; delete values.id; delete values.system_slug; delete values.usedRequests; delete values.usedTokens; if (!id) return AIQuotaPolicy.create(values); const quota = await AIQuotaPolicy.findOneAndUpdate({ _id: id, workspaceId: ws._id }, values, { new: true, runValidators: true }); if (!quota) throw notFoundError("Quota policy not found."); return quota; };
export const deleteAIQuotaService = async (user: AuthenticatedUserContext, slug: string | undefined, id: string) => { const ws = await resolveWorkspace(user, slug); const quota = await AIQuotaPolicy.findOneAndDelete({ _id: id, workspaceId: ws._id }); if (!quota) throw notFoundError("Quota policy not found."); return { id, deleted: true }; };
export const getAIAnalyticsService = async (user: AuthenticatedUserContext, slug?: string) => {
    const ws = await resolveWorkspace(user, slug); const match = { workspaceId: ws._id };
    const [providers, daily, statuses] = await Promise.all([
        AIRequestLog.aggregate([{ $match: match }, { $group: { _id: "$provider", requests: { $sum: 1 }, tokens: { $sum: "$totalTokens" }, avgLatencyMs: { $avg: "$latencyMs" }, costUsd: { $sum: "$estimatedCostUsd" } } }, { $sort: { requests: -1 } }]),
        AIRequestLog.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, requests: { $sum: 1 }, tokens: { $sum: "$totalTokens" }, failures: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
        AIRequestLog.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]); return { providers, daily, statuses };
};
