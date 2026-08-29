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

export const StreamRequestSchema = z.object({
    messages: z.array(CoreMessageSchema),
    provider: z.string().optional().default('vercel'),
    options: z.object({
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().positive().optional(),
        systemPrompt: z.string().optional(),
    }).catchall(z.any()).optional(),
});

export const GenerateRequestSchema = z.object({
    prompt: z.union([z.string(), z.array(CoreMessageSchema)]),
    provider: z.string().optional().default('vercel'),
    options: z.object({
        model: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
    }).catchall(z.any()).optional(),
});
