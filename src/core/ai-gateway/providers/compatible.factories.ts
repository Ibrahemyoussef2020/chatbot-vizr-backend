import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { AIGatewayOptions } from "../ai.interface.js";

interface CompatibleProviderConfig { name: string; keyEnv: string; baseURL: () => string; defaultModel: string; }
const configs: Record<string, CompatibleProviderConfig> = {
    openrouter: { name: "openrouter", keyEnv: "OPENROUTER_API_KEY", baseURL: () => "https://openrouter.ai/api/v1", defaultModel: "openrouter/free" },
    mistral: { name: "mistral", keyEnv: "MISTRAL_API_KEY", baseURL: () => "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest" },
    cohere: { name: "cohere", keyEnv: "COHERE_API_KEY", baseURL: () => "https://api.cohere.ai/compatibility/v1", defaultModel: "command-r7b-12-2024" },
    nvidia: { name: "nvidia", keyEnv: "NVIDIA_API_KEY", baseURL: () => "https://integrate.api.nvidia.com/v1", defaultModel: "meta/llama-3.1-8b-instruct" },
    sambanova: { name: "sambanova", keyEnv: "SAMBANOVA_API_KEY", baseURL: () => "https://api.sambanova.ai/v1", defaultModel: "Meta-Llama-3.3-70B-Instruct" },
    orcarouter: { name: "orcarouter", keyEnv: "ORCAROUTER_API_KEY", baseURL: () => "https://api.orcarouter.ai/v1", defaultModel: "orcarouter/free" },
    cloudflare: { name: "cloudflare", keyEnv: "CLOUDFLARE_API_TOKEN", baseURL: () => `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`, defaultModel: "@cf/meta/llama-3.1-8b-instruct-fp8-fast" },
    ollama: { name: "ollama", keyEnv: "OLLAMA_API_KEY", baseURL: () => "https://ollama.com/v1", defaultModel: "gpt-oss:20b" },
};

export const compatibleProviderCodes = Object.keys(configs);
export const createCompatibleModelFactory = (code: string) => (options?: AIGatewayOptions): LanguageModel => {
    const config = configs[code]; if (!config) throw new Error(`Unknown compatible provider: ${code}`);
    const apiKey = process.env[config.keyEnv]?.trim(); if (!apiKey) throw new Error(`Missing ${config.keyEnv} in environment variables.`);
    if (code === "cloudflare" && !process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID in environment variables.");
    return createOpenAI({ name: config.name, apiKey, baseURL: config.baseURL() })(options?.model || config.defaultModel);
};
