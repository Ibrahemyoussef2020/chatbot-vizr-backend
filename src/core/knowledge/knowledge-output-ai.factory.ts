import type { IKnowledgeOutputAI } from "./knowledge-output-ai.interface.js";

export type KnowledgeAIProviderType = "vercel" | "custom" | string;

export class KnowledgeOutputAIFactory {
    private static providers = new Map<KnowledgeAIProviderType, IKnowledgeOutputAI>();

    static registerProvider(name: KnowledgeAIProviderType, provider: IKnowledgeOutputAI): void {
        this.providers.set(name, provider);
    }

    static getProvider(name: KnowledgeAIProviderType = "vercel"): IKnowledgeOutputAI {
        const provider = this.providers.get(name);
        if (!provider) throw new Error(`Knowledge AI provider "${name}" is not registered.`);
        return provider;
    }
}
