import { streamText, generateText, ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { Response } from 'express';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class VercelAIProvider implements IAIService {
    private getProviderDetails() {
        const rawGatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
        const rawOpenAIKey = process.env.OPENAI_API_KEY?.trim();
        const rawSecretKey = process.env.OPEN_AI_SECRET_KEY?.trim();

        const gatewayKey = rawGatewayKey && !rawGatewayKey.includes("your_") ? rawGatewayKey : undefined;
        const openAIKey = rawOpenAIKey && !rawOpenAIKey.includes("your_") ? rawOpenAIKey : undefined;
        const secretKey = rawSecretKey && !rawSecretKey.includes("AI_Chatbot_Key") && !rawSecretKey.includes("your_") ? rawSecretKey : undefined;

        const apiKey = gatewayKey || openAIKey || secretKey || "";
        if (!apiKey) {
            throw new Error("Missing OpenAI API Key. Please configure OPENAI_API_KEY=sk-..., OPEN_AI_SECRET_KEY=sk-..., or AI_GATEWAY_API_KEY=vck_... in your environment variables.");
        }


        const isVercelGateway = Boolean(process.env.AI_GATEWAY_BASE_URL || apiKey.startsWith('vck_'));
        const baseURL = process.env.AI_GATEWAY_BASE_URL || (isVercelGateway ? 'https://ai-gateway.vercel.app/v1' : undefined);

        const openai = createOpenAI({
            apiKey,
            ...(baseURL ? { baseURL } : {}),
        });

        return { openai, isVercelGateway };
    }

    private resolveModelName(requestedModel: string | undefined, isVercelGateway: boolean): string {
        if (!requestedModel) {
            return isVercelGateway ? "openai/gpt-4o-mini" : "gpt-4o-mini";
        }
        // If Vercel Gateway is used and no provider prefix (e.g. "anthropic/", "google/") is present, default to "openai/"
        if (isVercelGateway && !requestedModel.includes("/")) {
            return `openai/${requestedModel}`;
        }
        return requestedModel;
    }


    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            const { openai, isVercelGateway } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model, isVercelGateway);
            const result = await streamText({
                model: openai(modelName),
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
            const { openai, isVercelGateway } = this.getProviderDetails();
            const modelName = this.resolveModelName(options?.model, isVercelGateway);
            const isString = typeof prompt === 'string';
            const { text } = await generateText({
                model: openai(modelName),
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


