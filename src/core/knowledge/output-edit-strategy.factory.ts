import { z } from "zod";
import { AIFactory } from "../ai-gateway/ai-gateway.factory.js";
import { unprocessableEntityError } from "../shared/errors/HttpError.js";

export const outputSectionPayloadSchema = z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(20000).default(""),
    notes: z.array(z.object({
        title: z.string().min(1).max(240),
        description: z.string().max(10000).default(""),
        meta: z.string().max(500).optional(),
        status: z.string().max(80).optional(),
    })).default([]),
    charts: z.array(z.object({
        title: z.string().min(1).max(240),
        description: z.string().max(1000).optional(),
        kind: z.enum(["bars", "progress", "donut", "timeline"]),
        items: z.array(z.object({
            label: z.string().min(1).max(240),
            value: z.number().finite(),
            detail: z.string().max(500).optional(),
            tone: z.enum(["primary", "success", "warning", "danger"]).optional(),
        })).default([]),
    })).default([]),
});

export type OutputSectionPayload = z.infer<typeof outputSectionPayloadSchema>;

const parsePayload = (input: unknown) => {
    const result = outputSectionPayloadSchema.safeParse(input);
    if (!result.success) throw unprocessableEntityError(result.error.issues[0]?.message || "Invalid output schema.");
    return result.data;
};

interface OutputEditStrategy {
    edit(current: OutputSectionPayload, input: unknown): Promise<OutputSectionPayload>;
}

class ManualOutputEditStrategy implements OutputEditStrategy {
    async edit(_current: OutputSectionPayload, input: unknown) {
        return parsePayload(input);
    }
}

class AIOutputEditStrategy implements OutputEditStrategy {
    async edit(current: OutputSectionPayload, input: unknown) {
        const instructionResult = z.object({ instruction: z.string().trim().min(1).max(5000) }).safeParse(input);
        if (!instructionResult.success) throw unprocessableEntityError(instructionResult.error.issues[0]?.message || "An AI editing instruction is required.");
        const instruction = instructionResult.data.instruction;
        const ai = AIFactory.getProvider((process.env.DEFAULT_AI_PROVIDER || "vercel").trim());
        const response = await ai.generate(`Current section JSON:\n${JSON.stringify(current)}\n\nEditing instruction:\n${instruction}\n\nReturn only valid JSON with title, description, notes, and charts. Preserve information not affected by the instruction.`, {
            systemPrompt: "You edit one generated plan/report section. Return JSON only, without markdown fences. Charts must use bars, progress, donut, or timeline.",
        });
        try {
            return parsePayload(JSON.parse(response.replace(/^\s*```(?:json)?|```\s*$/g, "").trim()));
        } catch {
            throw unprocessableEntityError("AI returned an invalid section schema. Retry this section.");
        }
    }
}

export class OutputEditStrategyFactory {
    static create(mode: string): OutputEditStrategy {
        if (mode === "manual") return new ManualOutputEditStrategy();
        if (mode === "ai") return new AIOutputEditStrategy();
        throw unprocessableEntityError("Edit mode must be manual or ai.");
    }
}
