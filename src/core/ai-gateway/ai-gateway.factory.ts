import { IAIService } from './ai.interface.js';
import { assertAIProviderEnabled } from '../../services/aiProviderPolicy.js';

export type AIProviderType = 'vercel' | 'custom' | string;

export class AIFactory {
    private static providerRegistry: Map<AIProviderType, IAIService> = new Map();


    public static registerProvider(provider: AIProviderType, service: IAIService): void {
        this.providerRegistry.set(provider, service);
        console.log(`[AIFactory] Provider registered successfully: "${provider}"`);
    }


    public static getProvider(provider: AIProviderType = 'vercel'): IAIService {
        const service = this.providerRegistry.get(provider);
        if (!service) {
            throw new Error(
                `[AIFactory] Provider "${provider}" is not registered. ` +
                `Make sure to register it using AIFactory.registerProvider()`
            );
        }
        return {
            async generate(prompt, options) {
                await assertAIProviderEnabled(provider);
                return service.generate(prompt, options);
            },
            async stream(messages, response, options) {
                await assertAIProviderEnabled(provider);
                await service.stream(messages, response, options);
            },
        };
    }
}
