import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { AIGatewayOptions } from '../ai.interface.js';
import { LanguageModel } from 'ai';

const isUsableSecret = (value?: string): value is string => {
    const normalized = value?.trim();
    return Boolean(
        normalized
        && !/placeholder|your[_-]?|demo|changeme/i.test(normalized),
    );
};

export const resolveOpenAIKey = (): string | undefined => {
    const standardKey = process.env.OPENAI_API_KEY?.trim();
    if (isUsableSecret(standardKey)) return standardKey;

    const legacyKey = process.env.OPEN_AI_SECRET_KEY?.trim();
    return isUsableSecret(legacyKey) ? legacyKey : undefined;
};

export const createGoogleModel = (options?: AIGatewayOptions): LanguageModel => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY in environment variables.");
    const google = createGoogleGenerativeAI({ apiKey });
    const modelName = options?.model || "gemini-3.6-flash";
    return google(modelName);
};

export const createOpenAIModel = (options?: AIGatewayOptions): LanguageModel => {
    const apiKey = resolveOpenAIKey();
    if (!apiKey) {
        throw new Error("Missing a valid OPENAI_API_KEY (or legacy OPEN_AI_SECRET_KEY) in environment variables.");
    }
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
