import { streamText, generateText, ModelMessage } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class AnthropicProvider implements IAIService {
    private getProviderDetails() {
        const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
        
        if (!apiKey) {
            throw new Error("Missing ANTHROPIC_API_KEY in environment variables.");
        }

        const anthropic = createAnthropic({
            apiKey,
        });

        return { anthropic };
    }

    private resolveModelName(requestedModel: string | undefined): string {
        return requestedModel || "claude-3-5-sonnet-20240620"; // default to claude-3.5-sonnet
    }

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const { anthropic } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const result = await streamText({
                model: anthropic(modelName),
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            result.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('[AnthropicProvider] Stream Error:', error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const { anthropic } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model: anthropic(modelName),
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            return text;
        } catch (error) {
            console.error('[AnthropicProvider] Generate Error:', error);
            throw error;
        }
    }
}
