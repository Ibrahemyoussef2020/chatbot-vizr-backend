import { streamText, generateText, ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class VercelAIProvider implements IAIService {
    private getProvider() {
        const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
        const baseURL = process.env.AI_GATEWAY_BASE_URL || (apiKey?.startsWith('vck_') ? 'https://ai-gateway.vercel.app/v1' : undefined);

        return createOpenAI({
            apiKey: apiKey || '',
            ...(baseURL ? { baseURL } : {}),
        });
    }

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const provider = this.getProvider();
            const result = await streamText({
                model: provider(options?.model || 'gpt-4o'),
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
                system: options?.systemPrompt,
            });

            result.pipeTextStreamToResponse(res);
        } catch (error) {
            console.error('[VercelAIProvider] Stream Error:', error);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const provider = this.getProvider();
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model: provider(options?.model || 'gpt-4o'),
                ...(isString ? { prompt } : { messages: prompt }),
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens: options?.maxTokens,
            });
            return text;
        } catch (error) {
            console.error('[VercelAIProvider] Generate Error:', error);
            throw error;
        }
    }
}

