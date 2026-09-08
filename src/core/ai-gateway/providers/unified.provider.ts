import { streamText, generateText, ModelMessage, LanguageModel } from 'ai';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export type ModelFactory = (options?: AIGatewayOptions) => LanguageModel;

export class UnifiedAIProvider implements IAIService {
    constructor(
        private providerName: string,
        private modelFactory: ModelFactory
    ) {}

    private getModel(options?: AIGatewayOptions): LanguageModel {
        return this.modelFactory(options);
    }

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const model = this.getModel(options);
            const result = await streamText({
                model,
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
                maxRetries: options?.maxRetries ?? 2,
                abortSignal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
            });

            result.pipeTextStreamToResponse(res);
            await result.text;
            const usage = await result.usage;
            if (typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
                options?.onUsage?.({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
            }
        } catch (error) {
            console.error(`[UnifiedAIProvider:${this.providerName}] Stream Error:`, error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const model = this.getModel(options);
            const isString = typeof prompt === 'string';
            const { text, usage } = await generateText({
                model,
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
                maxRetries: options?.maxRetries ?? 2,
                abortSignal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
            });

            if (typeof usage.inputTokens === "number" && typeof usage.outputTokens === "number") {
                options?.onUsage?.({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
            }
            return text;
        } catch (error) {
            console.error(`[UnifiedAIProvider:${this.providerName}] Generate Error:`, error);
            throw error;
        }
    }
}
