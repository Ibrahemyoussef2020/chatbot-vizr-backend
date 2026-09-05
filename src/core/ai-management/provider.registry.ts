export interface ProviderDefinition { code: string; name: string; keyEnvName: string; accountEnvName?: string; baseUrl?: string; }

export const providerDefinitions: ProviderDefinition[] = [
    { code: "google", name: "Google Gemini", keyEnvName: "GOOGLE_GENERATIVE_AI_API_KEY" },
    { code: "openrouter", name: "OpenRouter", keyEnvName: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1" },
    { code: "cohere", name: "Cohere", keyEnvName: "COHERE_API_KEY" },
    { code: "mistral", name: "Mistral", keyEnvName: "MISTRAL_API_KEY" },
    { code: "nvidia", name: "NVIDIA NIM", keyEnvName: "NVIDIA_API_KEY", baseUrl: "https://integrate.api.nvidia.com/v1" },
    { code: "cloudflare", name: "Cloudflare Workers AI", keyEnvName: "CLOUDFLARE_API_TOKEN", accountEnvName: "CLOUDFLARE_ACCOUNT_ID" },
    { code: "sambanova", name: "SambaNova", keyEnvName: "SAMBANOVA_API_KEY", baseUrl: "https://api.sambanova.ai/v1" },
    { code: "ollama", name: "Ollama Cloud", keyEnvName: "OLLAMA_API_KEY", baseUrl: "https://ollama.com/api" },
    { code: "orcarouter", name: "OrcaRouter", keyEnvName: "ORCAROUTER_API_KEY", baseUrl: "https://api.orcarouter.ai/v1" },
];

export const hasProviderCredentials = (definition: ProviderDefinition) => Boolean(process.env[definition.keyEnvName]?.trim() && (!definition.accountEnvName || process.env[definition.accountEnvName]?.trim()));
