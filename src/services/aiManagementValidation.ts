import { z } from "zod";
import { unprocessableEntityError } from "../core/shared/errors/HttpError.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid ID is required.");
export const modelInputSchema = z.object({
    providerId: objectId,
    externalId: z.string().trim().min(1).max(240),
    displayName: z.string().trim().min(1).max(240),
    alias: z.string().trim().max(120).optional(),
    enabled: z.boolean().default(true),
    priority: z.number().int().min(0).default(100),
    contextWindow: z.number().int().positive().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    capabilities: z.object({
        text: z.boolean().optional(), vision: z.boolean().optional(), tools: z.boolean().optional(),
        streaming: z.boolean().optional(), reasoning: z.boolean().optional(),
    }).optional(),
});
export const agentInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    systemPrompt: z.string().trim().min(1).max(32000),
    securityRoleId: objectId,
    primaryModelId: objectId,
    fallbackModelIds: z.array(objectId).max(10).default([]),
    channels: z.array(z.enum(["web", "whatsapp", "telegram", "instagram", "gmail"])).default([]),
    tools: z.array(z.enum(["knowledge-search", "conversation-context"])).default([]),
    temperature: z.number().min(0).max(2).default(0.35),
    maxOutputTokens: z.number().int().min(1).max(100000).default(1200),
    timeoutMs: z.number().int().min(1000).max(300000).default(45000),
    enabled: z.boolean().default(true),
});

export const routingInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    agentId: objectId.nullable().optional(),
    strategy: z.enum(["priority", "round_robin", "least_used", "lowest_latency", "quota_aware"]).default("priority"),
    modelIds: z.array(objectId).min(1).max(11),
    maxRetries: z.number().int().min(0).max(10).default(2),
    timeoutMs: z.number().int().min(1000).max(300000).default(45000),
    enabled: z.boolean().default(true),
});

export const quotaInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    scope: z.enum(["workspace", "agent", "provider", "model"]),
    scopeId: objectId.nullable().optional(),
    period: z.enum(["minute", "day", "month"]),
    requestLimit: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    tokenLimit: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
    concurrencyLimit: z.number().int().min(1).max(10000).default(1),
    enabled: z.boolean().default(true),
}).refine(value => value.scope === "workspace" || Boolean(value.scopeId), {
    message: "Select the agent, provider, or model this quota applies to.",
    path: ["scopeId"],
});

export const parseAIInput = <T>(schema: z.ZodType<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const issue = result.error.issues[0];
        throw unprocessableEntityError(`${issue.path.join(".")}: ${issue.message}`);
    }
    return result.data;
};
