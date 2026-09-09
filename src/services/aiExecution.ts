import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import type { AIGatewayOptions, IAIService } from "../core/ai-gateway/ai.interface.js";
import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";
import { forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import AIAgent from "../models/AIAgent.js";
import AIModel from "../models/AIModel.js";
import AIProvider from "../models/AIProvider.js";
import SecurityRole from "../models/SecurityRole.js";
import Workspace from "../models/Workspace.js";
import type { ModelMessage } from "ai";
import AIRequestLog from "../models/AIRequestLog.js";
import HttpError, { createHttpError } from "../core/shared/errors/HttpError.js";
import { loadAIRoutingPolicy, orderRoutingModels } from "./aiRouting.js";
import { reserveAIQuotas, settleAIQuotas, type AIQuotaReservation } from "./aiQuota.js";

export interface ExecutionModel {
    id: string;
    providerId: string;
    provider: string;
    externalId: string;
    maxOutputTokens?: number | null;
    priority: number;
    streaming?: boolean;
}

export interface AIExecutionConfig {
    workspaceId: string;
    agentId?: string;
    systemPrompt?: string;
    allowKnowledge: boolean;
    allowHistory: boolean;
    models: ExecutionModel[];
    options: AIGatewayOptions;
}

export interface AIExecutionTransport {
    run: (provider: IAIService, history: ModelMessage[], options: AIGatewayOptions) => Promise<string>;
    isCommitted: () => boolean;
}

export const resolveExecutionModel = async (id: string): Promise<ExecutionModel> => {
    if (!Types.ObjectId.isValid(id)) {
        throw unprocessableEntityError("The agent has an invalid model reference.");
    }
    const model = await AIModel.findById(id).lean().exec();
    if (!model) {
        throw unprocessableEntityError("An assigned AI model no longer exists.");
    }
    const provider = await AIProvider.findById(model.providerId).lean().exec();
    if (!provider) {
        throw unprocessableEntityError("The assigned model's provider no longer exists.");
    }
    if (!model.enabled || !provider.enabled) {
        throw forbiddenError("The assigned AI model or provider is disabled.");
    }
    if (model.capabilities?.text === false) {
        throw unprocessableEntityError("The assigned model does not support text replies.");
    }
    return {
        id: String(model._id),
        providerId: String(provider._id),
        provider: provider.code,
        externalId: model.externalId,
        maxOutputTokens: model.maxOutputTokens,
        priority: model.priority,
        streaming: model.capabilities?.streaming !== false,
    };
};

export const resolveAIExecutionConfig = async (input: {
    systemSlug: string;
    channel: string;
    providerName?: string;
    modelName?: string;
}): Promise<AIExecutionConfig> => {
    const workspace = await Workspace.findOne({ slug: input.systemSlug, isActive: true }).lean().exec();
    if (!workspace) {
        throw notFoundError("Active workspace not found.");
    }
    if (!workspace.defaultAiAgentId) {
        const providerName = input.providerName?.trim() || process.env.DEFAULT_AI_PROVIDER?.trim() || "vercel";
        const provider = await AIProvider.findOne({ code: providerName }).lean().exec();
        const model = provider && input.modelName
            ? await AIModel.findOne({ providerId: provider._id, externalId: input.modelName }).lean().exec()
            : null;
        if (provider?.enabled === false || model?.enabled === false) {
            throw forbiddenError("The selected AI provider or model is disabled.");
        }
        return {
            workspaceId: String(workspace._id),
            allowKnowledge: true,
            allowHistory: true,
            models: [{
                id: model ? String(model._id) : "",
                providerId: provider ? String(provider._id) : "",
                provider: providerName,
                externalId: input.modelName ?? "",
                priority: 100,
            }],
            options: {
                ...(input.modelName && { model: input.modelName }),
                maxTokens: positiveEnvironmentInteger(process.env.CHAT_AI_MAX_OUTPUT_TOKENS, 1200),
                timeoutMs: positiveEnvironmentInteger(process.env.CHAT_AI_TIMEOUT_MS, 45000),
            },
        };
    }

    const agent = await AIAgent.findOne({
        _id: workspace.defaultAiAgentId,
        workspaceId: workspace._id,
    }).lean().exec();
    if (!agent || !agent.enabled) {
        throw forbiddenError("The workspace's assigned AI agent is missing or disabled.");
    }
    if (agent.channels.length && !agent.channels.includes(input.channel)) {
        throw forbiddenError("The assigned AI agent cannot reply on this channel.");
    }
    const role = await SecurityRole.findOne({
        _id: agent.securityRoleId,
        scope: "workspace",
        $or: [{ workspaceId: workspace._id }, { workspaceId: null }],
    }).lean().exec();
    if (!role) {
        throw forbiddenError("The assigned AI agent's security role is unavailable.");
    }
    const policy = await loadAIRoutingPolicy(String(workspace._id), String(agent._id));
    const ids = policy?.modelIds.map(String) ?? [String(agent.primaryModelId), ...agent.fallbackModelIds.map(String)];
    const candidates: ExecutionModel[] = [];
    for (const id of [...new Set(ids)]) {
        try {
            candidates.push(await resolveExecutionModel(id));
        } catch (error) {
            // A disabled candidate may be skipped only for another explicitly assigned model.
            if (!(error instanceof HttpError) || error.statusCode !== 403) throw error;
        }
    }
    if (!candidates.length) {
        throw forbiddenError("No enabled assigned AI models are available.");
    }
    const models = await orderRoutingModels(candidates, policy, String(workspace._id));
    return {
        workspaceId: String(workspace._id),
        agentId: String(agent._id),
        systemPrompt: agent.systemPrompt,
        allowKnowledge: agent.tools.includes("knowledge-search") && role.permissions.includes("knowledge.use"),
        allowHistory: agent.tools.includes("conversation-context") && role.permissions.includes("inbox.view"),
        models,
        options: {
            temperature: agent.temperature ?? 0.35,
            maxTokens: agent.maxOutputTokens ?? 1200,
            timeoutMs: Math.min(agent.timeoutMs ?? 45000, policy?.timeoutMs ?? Infinity),
            maxRetries: policy?.maxRetries ?? Math.max(0, models.length - 1),
            fallbackModels: [],
        },
    };
};

export const generateAIReply = async (
    config: AIExecutionConfig,
    history: ModelMessage[],
    systemPrompt: string,
    transport?: AIExecutionTransport,
): Promise<string> => {
    const deadline = Date.now() + (config.options.timeoutMs ?? 45000);
    const attempts = config.models.slice(0, (config.options.maxRetries ?? 0) + 1);
    let lastError: unknown;
    for (const [index, candidate] of attempts.entries()) {
        const started = Date.now();
        const remaining = deadline - started;
        if (remaining <= 0) throw createHttpError(504, "AI execution exceeded its configured timeout.");
        let usage: { inputTokens: number; outputTokens: number } | undefined;
        let reservations: AIQuotaReservation[] = [];
        let providerStarted = false;
        try {
            const model = candidate.id ? await resolveExecutionModel(candidate.id) : candidate;
            if (transport && model.streaming === false) {
                throw forbiddenError("This assigned model does not support streaming.");
            }
            const maxTokens = Math.min(config.options.maxTokens ?? 1200, model.maxOutputTokens ?? Infinity);
            // UTF-8 bytes deliberately over-reserve ordinary text input. Hidden
            // upstream overhead is covered by a margin; reported usage is authoritative.
            const inputBudget = Buffer.byteLength(JSON.stringify(history) + systemPrompt, "utf8") + 1024;
            reservations = await reserveAIQuotas({
                workspaceId: config.workspaceId,
                agentId: config.agentId,
                providerId: model.providerId || undefined,
                modelId: model.id || undefined,
            }, inputBudget + maxTokens, remaining);
            const executionTimeout = deadline - Date.now();
            if (executionTimeout <= 0) throw createHttpError(504, "AI execution exceeded its configured timeout.");
            const settings: AIGatewayOptions = {
                ...config.options,
                ...(model.externalId && { model: model.externalId }),
                maxTokens,
                ...(config.agentId && {
                    maxRetries: 0,
                }),
                timeoutMs: executionTimeout,
                systemPrompt,
                gatewayUser: config.workspaceId,
                onUsage: value => { usage = value; },
            };
            const provider = AIFactory.getProvider(model.provider);
            providerStarted = true;
            const content = transport
                ? await transport.run(provider, history, settings)
                : await provider.generate(history, settings);
            await recordExecution(config, model, started, index, usage, undefined, Boolean(transport));
            return content;
        } catch (error) {
            lastError = error;
            console.error(`[AI execution] ${candidate.provider}/${candidate.externalId || "provider-default"} failed:`, error);
            await recordExecution(config, candidate, started, index, usage, error, Boolean(transport));
            if (transport?.isCommitted()) throw error;
            if (error instanceof HttpError && ![403, 429, 502, 503, 504].includes(error.statusCode)) throw error;
        } finally {
            try {
                await settleAIQuotas(reservations, usage ? usage.inputTokens + usage.outputTokens : undefined, !providerStarted);
            } catch {
                // Do not retry an already completed generation because settlement failed.
                console.error("[AI quota] Settlement failed; conservative usage remains charged until window reset.");
            }
        }
    }
    if (lastError instanceof HttpError) throw lastError;
    throw createHttpError(502, "All configured AI models failed to reply.");
};

const positiveEnvironmentInteger = (value: string | undefined, fallback: number) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

const recordExecution = async (
    config: AIExecutionConfig,
    model: ExecutionModel,
    started: number,
    fallbackAttempts: number,
    usage?: { inputTokens: number; outputTokens: number },
    error?: unknown,
    streaming = false,
) => {
    try {
        await AIRequestLog.create({
            workspaceId: config.workspaceId,
            agentId: config.agentId,
            provider: model.provider,
            model: model.externalId || "provider-default",
            requestType: streaming ? "stream" : "generate",
            source: "runtime",
            usageReported: Boolean(usage),
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
            totalTokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
            latencyMs: Date.now() - started,
            status: error ? "failed" : fallbackAttempts ? "fallback" : "success",
            statusCode: error instanceof HttpError ? error.statusCode : error ? 502 : 200,
            errorMessage: error ? "AI execution failed or was rejected by policy." : undefined,
            correlationId: randomUUID(),
            fallbackAttempts,
        });
    } catch {
        // A telemetry outage must not repeat a completed provider call.
        console.error("[AI execution] Could not persist request telemetry.");
    }
};
