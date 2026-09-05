import { randomUUID } from "node:crypto";
import { AIAgent, AIModel, AIProvider, AIQuotaPolicy, AIRequestLog, AIRoutingPolicy, SecurityRole } from "../models/index.js";
import { workspacePermissionIds } from "../core/security/permission.registry.js";
import { providerDefinitions } from "../core/ai-management/provider.registry.js";

const catalogs: Record<string, string[]> = {
    google: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    openrouter: ["openrouter/free", "deepseek/deepseek-r1:free", "qwen/qwen3-coder:free"],
    cohere: ["command-a", "command-r-plus", "command-r7b-12-2024"],
    mistral: ["mistral-small-latest", "mistral-medium-latest", "codestral-latest"],
    nvidia: ["meta/llama-3.1-8b-instruct", "openai/gpt-oss-120b", "deepseek-ai/deepseek-v3.1"],
    cloudflare: ["@cf/meta/llama-3.1-8b-instruct-fp8-fast", "@cf/google/gemma-3-12b-it", "@cf/qwen/qwen3-30b-a3b-fp8"],
    sambanova: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-V3.1", "gpt-oss-120b"],
    ollama: ["gpt-oss:20b", "gemma3:12b", "qwen3:30b"], orcarouter: ["orcarouter/free", "deepseek/deepseek-v4-flash-free"],
};
const agentTemplates = [
    ["Customer Support", "customer-support", "Resolve customer questions using approved workspace knowledge."],
    ["Sales Concierge", "sales-concierge", "Qualify leads, explain plans and collect contact details."],
    ["Knowledge Analyst", "knowledge-analyst", "Analyze sources and return cited, structured answers."],
    ["Business Planner", "business-planner", "Create practical business plans, milestones and risk analysis."],
    ["Quality Reviewer", "quality-reviewer", "Review draft responses for accuracy, tone and policy compliance."],
    ["Fallback Assistant", "fallback-assistant", "Provide a safe helpful response when specialized agents fail."],
];

export const seedAIManagement = async (workspaces: any[]) => {
    const providers = new Map<string, any>();
    for (let i = 0; i < providerDefinitions.length; i++) { const d = providerDefinitions[i]; const p = await AIProvider.findOneAndUpdate({ code: d.code }, { $set: { ...d, enabled: true, priority: (i + 1) * 10, health: i % 5 === 4 ? "degraded" : "healthy", lastCheckedAt: new Date(), lastError: i % 5 === 4 ? "Occasional upstream rate limiting" : "" } }, { upsert: true, new: true }); providers.set(d.code, p); }
    const models: any[] = [];
    for (const [code, ids] of Object.entries(catalogs)) for (let i = 0; i < ids.length; i++) { const model = await AIModel.findOneAndUpdate({ providerId: providers.get(code)._id, externalId: ids[i] }, { $set: { displayName: ids[i].split("/").pop(), alias: `${code}-${i + 1}`, enabled: true, priority: (i + 1) * 10, contextWindow: i === 0 ? 128000 : 64000, maxOutputTokens: 4096, capabilities: { text: true, vision: i === 1, tools: i !== 2, streaming: true, reasoning: i === 2 } } }, { upsert: true, new: true }); models.push(model); }
    let agentsCount = 0; let logsCount = 0;
    for (const ws of workspaces) {
        const role = await SecurityRole.findOneAndUpdate({ workspaceId: ws._id, code: "ai_operator" }, { $set: { name: "AI Operator", description: "Shared role usable by human and AI principals.", scope: "workspace", isSystem: false, permissions: workspacePermissionIds.filter((p) => p.startsWith("knowledge.") || p.startsWith("inbox.") || p === "analytics.view") } }, { upsert: true, new: true });
        const agents: any[] = [];
        for (let i = 0; i < agentTemplates.length; i++) { const [name, slug, prompt] = agentTemplates[i]; const agent = await AIAgent.findOneAndUpdate({ workspaceId: ws._id, slug }, { $set: { securityRoleId: role._id, name, description: prompt, systemPrompt: `${prompt} Be concise, accurate and use tools only when permitted by your assigned security role.`, primaryModelId: models[i % models.length]._id, fallbackModelIds: [models[(i + 1) % models.length]._id, models[(i + 2) % models.length]._id], channels: ["web", i % 2 ? "telegram" : "whatsapp"], tools: ["knowledge-search", "conversation-context"], temperature: 0.25 + i * .08, maxOutputTokens: 1000 + i * 200, timeoutMs: 30000 + i * 3000, enabled: true } }, { upsert: true, new: true }); agents.push(agent); agentsCount++; }
        for (let i = 0; i < agents.length; i++) await AIRoutingPolicy.findOneAndUpdate({ workspaceId: ws._id, name: `${agents[i].name} Routing` }, { $set: { agentId: agents[i]._id, strategy: i % 2 ? "priority" : "quota_aware", enabled: true, modelIds: [agents[i].primaryModelId, ...agents[i].fallbackModelIds], maxRetries: 2, timeoutMs: agents[i].timeoutMs } }, { upsert: true });
        const quotas = [["Workspace Daily", "workspace", 12000, 2400000, 20], ["Agent Daily", "agent", 2500, 500000, 5], ["Provider Minute", "provider", 60, 120000, 8], ["Model Monthly", "model", 50000, 12000000, 12]] as const;
        for (let i = 0; i < quotas.length; i++) { const [name, scope, requests, tokens, concurrency] = quotas[i]; await AIQuotaPolicy.findOneAndUpdate({ workspaceId: ws._id, name }, { $set: { scope, scopeId: scope === "agent" ? agents[0]._id : scope === "provider" ? providers.values().next().value._id : scope === "model" ? models[0]._id : undefined, period: name.includes("Minute") ? "minute" : name.includes("Monthly") ? "month" : "day", requestLimit: requests, tokenLimit: tokens, concurrencyLimit: concurrency, usedRequests: Math.round(requests * (.18 + i * .12)), usedTokens: Math.round(tokens * (.18 + i * .12)), enabled: true, resetAt: new Date(Date.now() + (i === 2 ? 3600000 : 86400000)) } }, { upsert: true }); }
        await AIRequestLog.deleteMany({ workspaceId: ws._id, correlationId: /^demo-/ });
        const docs = Array.from({ length: 420 }, (_, i) => { const agent = agents[i % agents.length]; const model = models[(i * 7) % models.length]; const status = i % 29 === 0 ? "failed" : i % 11 === 0 ? "fallback" : "success"; const promptTokens = 120 + (i * 37) % 1800; const completionTokens = status === "failed" ? 0 : 80 + (i * 53) % 950; return { workspaceId: ws._id, agentId: agent._id, provider: Array.from(providers.keys())[(i * 3) % providers.size], model: model.externalId, requestType: i % 4 ? "generate" : "stream", promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, latencyMs: 280 + (i * 97) % 6200, status, statusCode: status === "failed" ? 429 : 200, errorCode: status === "failed" ? "RATE_LIMITED" : undefined, errorMessage: status === "failed" ? "Provider quota temporarily exceeded" : undefined, fallbackAttempts: status === "fallback" ? 1 : 0, estimatedCostUsd: Number(((promptTokens + completionTokens) * .00000045).toFixed(6)), correlationId: `demo-${ws.slug}-${i}-${randomUUID().slice(0, 8)}`, createdAt: new Date(Date.now() - (i % 30) * 86400000 - (i * 7919) % 86400000), updatedAt: new Date() }; });
        await AIRequestLog.insertMany(docs); logsCount += docs.length;
    }
    return { providers: providers.size, models: models.length, agents: agentsCount, logs: logsCount };
};
