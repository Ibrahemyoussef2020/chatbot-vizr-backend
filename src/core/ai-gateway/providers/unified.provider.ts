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
            });

            result.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error(`[UnifiedAIProvider:${this.providerName}] Stream Error:`, error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const model = this.getModel(options);
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model,
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            return text;
        } catch (error) {
            console.error(`[UnifiedAIProvider:${this.providerName}] Generate Error:`, error);
            throw error;
        }
    }
}
