import { streamText, generateText, ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class GoogleAIProvider implements IAIService {
    private getProviderDetails() {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
        
        if (!apiKey) {
            throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY in environment variables.");
        }

        const google = createGoogleGenerativeAI({
            apiKey,
        });

        return { google };
    }

    private resolveModelName(requestedModel: string | undefined): string {
        return requestedModel || "gemini-2.5-flash"; // default to gemini-2.5-flash as it is free and fast
    }

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const { google } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const result = await streamText({
                model: google(modelName),
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            result.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('[GoogleAIProvider] Stream Error:', error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const { google } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model);
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model: google(modelName),
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            return text;
        } catch (error) {
            console.error('[GoogleAIProvider] Generate Error:', error);
            throw error;
        }
    }
}
