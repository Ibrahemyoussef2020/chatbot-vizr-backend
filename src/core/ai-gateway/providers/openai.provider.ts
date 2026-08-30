import { streamText, generateText, ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class OpenAIProvider implements IAIService {
    private getProviderDetails() {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY in environment variables.");
        }

        const openai = createOpenAI({
            apiKey,
        });

        return { openai };
    }

    private resolveModelName(requestedModel: string | undefined): string {
        return requestedModel || "gpt-4o-mini"; // default to gpt-4o-mini
    }

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const { openai } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const result = await streamText({
                model: openai(modelName),
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            result.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('[OpenAIProvider] Stream Error:', error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const { openai } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model: openai(modelName),
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            return text;
        } catch (error) {
            console.error('[OpenAIProvider] Generate Error:', error);
            throw error;
        }
    }
}
