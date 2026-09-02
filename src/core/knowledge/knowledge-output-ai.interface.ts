import { z } from "zod";
import { outputSectionPayloadSchema } from "./output-edit-strategy.factory.js";

export const knowledgeOutputKindSchema = z.enum(["plan", "report"]);

export const generatedKnowledgeOutputSchema = z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(4000).default(""),
    category: z.string().max(120).default(""),
    schemas: z.array(outputSectionPayloadSchema.extend({
        key: z.string().trim().min(1).max(100),
        order: z.number().int().min(0),
    })).min(1).max(12),
});

export type KnowledgeOutputKind = z.infer<typeof knowledgeOutputKindSchema>;
export type GeneratedKnowledgeOutput = z.infer<typeof generatedKnowledgeOutputSchema>;

export interface KnowledgeOutputGenerationInput {
    kind: KnowledgeOutputKind;
    sessionTitle: string;
    instruction?: string;
    sources: Array<{ name: string; content: string }>;
}

export interface IKnowledgeOutputAI {
    generate(input: KnowledgeOutputGenerationInput): Promise<GeneratedKnowledgeOutput>;
}
