import { createGateway, generateText, streamText, type ModelMessage } from "ai";
import type { Response } from "express";
import type { AIGatewayOptions, IAIService } from "../ai.interface.js";

export const resolveChatGatewayConfig = (modelOverride?: string) => {
    const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing AI_GATEWAY_API_KEY for Vercel chat generation.");
    const primary = modelOverride?.trim() || process.env.CHAT_AI_MODEL?.trim() || "google/gemini-3.6-flash";
    const fallbacks = (process.env.CHAT_AI_FALLBACK_MODELS || "anthropic/claude-sonnet-4.6,openai/gpt-5.4-mini")
        .split(",")
        .map((model) => model.trim())
        .filter((model) => model && model !== primary);
    return { apiKey, primary, fallbacks };
};

export const requestSettings = (options?: AIGatewayOptions) => {
    const config = resolveChatGatewayConfig(options?.model);
    const gateway = createGateway({ apiKey: config.apiKey });
    return {
        config,
        model: gateway(config.primary),
        temperature: options?.temperature ?? 0.35,
        maxOutputTokens: options?.maxTokens ?? Number(process.env.CHAT_AI_MAX_OUTPUT_TOKENS || 1200),
        maxRetries: options?.maxRetries ?? 2,
        abortSignal: AbortSignal.timeout(options?.timeoutMs ?? Number(process.env.CHAT_AI_TIMEOUT_MS || 45_000)),
        providerOptions: {
            gateway: {
                models: options?.fallbackModels ?? config.fallbacks,
                caching: "auto" as const,
                tags: ["customer-chat"],
                user: typeof options?.gatewayUser === "string" ? options.gatewayUser : undefined,
                quotaEntityId: typeof options?.gatewayUser === "string" ? options.gatewayUser : undefined,
            },
        },
    };
};

export class VercelGatewayAIProvider implements IAIService {
    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        const settings = requestSettings(options);
        const result = streamText({
            model: settings.model,
            messages,
            system: options?.systemPrompt,
            temperature: settings.temperature,
            maxOutputTokens: settings.maxOutputTokens,
            maxRetries: settings.maxRetries,
            abortSignal: settings.abortSignal,
            providerOptions: settings.providerOptions,
        });
        result.pipeTextStreamToResponse(res);
        await result.text;
        const usage = await result.usage;
        if (typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
            options?.onUsage?.({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        const settings = requestSettings(options);
        const result = await generateText({
            model: settings.model,
            ...(typeof prompt === "string" ? { prompt } : { messages: prompt }),
            system: options?.systemPrompt,
            temperature: settings.temperature,
            maxOutputTokens: settings.maxOutputTokens,
            maxRetries: settings.maxRetries,
            abortSignal: settings.abortSignal,
            providerOptions: settings.providerOptions,
        });
        if (typeof result.usage.inputTokens === "number" && typeof result.usage.outputTokens === "number") {
            options?.onUsage?.({ inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
        }
        return result.text;
    }
}
