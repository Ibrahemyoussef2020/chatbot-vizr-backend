import { AIFactory } from "./ai-gateway.factory.js";
import { CustomAIProvider } from "./providers/custom.provider.js";
import { UnifiedAIProvider } from "./providers/unified.provider.js";
import { VercelGatewayAIProvider } from "./providers/vercel-gateway.provider.js";
import { createGoogleModel, createOpenAIModel, createAnthropicModel } from "./providers/factories.js";
import { compatibleProviderCodes, createCompatibleModelFactory } from "./providers/compatible.factories.js";

export const registerAIProviders = () => {
    AIFactory.registerProvider("custom", new CustomAIProvider());
    AIFactory.registerProvider("google", new UnifiedAIProvider("google", createGoogleModel));
    AIFactory.registerProvider("openai", new UnifiedAIProvider("openai", createOpenAIModel));
    AIFactory.registerProvider("anthropic", new UnifiedAIProvider("anthropic", createAnthropicModel));
    AIFactory.registerProvider("vercel", new VercelGatewayAIProvider());

    for (const providerCode of compatibleProviderCodes) {
        AIFactory.registerProvider(providerCode, new UnifiedAIProvider(providerCode, createCompatibleModelFactory(providerCode)));
    }

    if (!process.env.DEFAULT_AI_PROVIDER) process.env.DEFAULT_AI_PROVIDER = "vercel";
};
