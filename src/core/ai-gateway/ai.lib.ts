import { z } from 'zod';

export const CoreMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.union([
        z.string(),
        z.array(
            z.object({
                type: z.enum(['text', 'image']),
                text: z.string().optional(),
                image: z.string().optional(),
            })
        ),
    ]),
});

const GatewayOptionsSchema = z.object({
    model: z.string().trim().min(1).max(240).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(100000).optional(),
    systemPrompt: z.string().max(32000).optional(),
    systemSlug: z.string().trim().min(1).max(255).optional(),
    threadId: z.string().trim().min(1).max(255).optional(),
});

export const StreamRequestSchema = z.object({
    messages: z.array(CoreMessageSchema),
    provider: z.string().optional().default('vercel'),
    options: GatewayOptionsSchema.optional(),
});

export const GenerateRequestSchema = z.object({
    prompt: z.union([z.string(), z.array(CoreMessageSchema)]),
    provider: z.string().optional().default('vercel'),
    options: GatewayOptionsSchema.optional(),
});
