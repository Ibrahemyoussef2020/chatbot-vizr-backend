import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AIGatewayOptions } from '../ai.interface.js';
import { LanguageModel } from 'ai';

export const createGoogleModel = (options?: AIGatewayOptions): LanguageModel => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY in environment variables.");
    const google = createGoogleGenerativeAI({ apiKey });
    const modelName = options?.model || "gemini-3.6-flash";
    return google(modelName);
};

export const createOpenAIModel = (options?: AIGatewayOptions): LanguageModel => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment variables.");
    const openai = createOpenAI({ apiKey });
    const modelName = options?.model || "gpt-4o-mini";
    return openai(modelName);
};

export const createAnthropicModel = (options?: AIGatewayOptions): LanguageModel => {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in environment variables.");
    const anthropic = createAnthropic({ apiKey });
    const modelName = options?.model || "claude-3-5-sonnet-20240620";
    return anthropic(modelName);
};
