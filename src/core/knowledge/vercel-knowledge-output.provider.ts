import { createGateway, generateText, Output } from "ai";
import {
    generatedKnowledgeOutputSchema,
    type GeneratedKnowledgeOutput,
    type IKnowledgeOutputAI,
    type KnowledgeOutputGenerationInput,
} from "./knowledge-output-ai.interface.js";

const sectionGuidance = {
    plan: "Build an actionable plan with ordered sections covering the idea, requirements, warnings, work plan, implementation, and expected outcome.",
    report: "Build an evidence-based report with ordered sections covering an executive summary, current situation, findings, benefits, recommended solution, impact, risks, recommendations, and conclusion.",
} as const;

const configuredModels = () => {
    const primary = process.env.KNOWLEDGE_AI_MODEL?.trim() || "google/gemini-3.6-flash";
    const fallbacks = (process.env.KNOWLEDGE_AI_FALLBACK_MODELS || "anthropic/claude-sonnet-4.6,openai/gpt-5.4-mini")
        .split(",")
        .map((model) => model.trim())
        .filter((model) => model && model !== primary);
    return { primary, fallbacks };
};

export const resolveKnowledgeGatewayConfig = () => {
    const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing AI_GATEWAY_API_KEY for Vercel knowledge generation.");
    return { apiKey, ...configuredModels() };
};

export class VercelKnowledgeOutputProvider implements IKnowledgeOutputAI {
    async generate(input: KnowledgeOutputGenerationInput): Promise<GeneratedKnowledgeOutput> {
        const config = resolveKnowledgeGatewayConfig();
        const gateway = createGateway({ apiKey: config.apiKey });
        const context = input.sources.map((source, index) => `[Source ${index + 1}: ${source.name}]\n${source.content}`).join("\n\n");
        const { output } = await generateText({
            model: gateway(config.primary),
            output: Output.object({ schema: generatedKnowledgeOutputSchema }),
            system: "Generate a grounded knowledge-base output. Use only supplied source material. Never invent facts or numeric measurements. Charts may contain numbers only when supported by a source; otherwise use notes. Return the complete structured output requested by the schema.",
            prompt: [
                `Output type: ${input.kind}`,
                `Session: ${input.sessionTitle}`,
                sectionGuidance[input.kind],
                input.instruction ? `User instruction: ${input.instruction}` : "Create the most useful output supported by the sources.",
                `Sources:\n${context}`,
            ].join("\n\n"),
            temperature: 0.2,
            maxOutputTokens: 8000,
            maxRetries: 2,
            abortSignal: AbortSignal.timeout(Number(process.env.KNOWLEDGE_AI_TIMEOUT_MS || 90_000)),
            providerOptions: {
                gateway: {
                    models: config.fallbacks,
                    caching: "auto",
                    tags: ["knowledge-output", input.kind],
                },
            },
        });

        return generatedKnowledgeOutputSchema.parse(output);
    }
}
