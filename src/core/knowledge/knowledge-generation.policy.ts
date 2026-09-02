import { createHttpError } from "../shared/errors/HttpError.js";

let activeGenerations = 0;

const positiveInteger = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const boundKnowledgeSources = <T extends { name: string; extractedText?: string }>(sources: T[]) => {
    const totalBudget = positiveInteger(process.env.KNOWLEDGE_CONTEXT_MAX_CHARS, 48_000);
    const sourceLimit = Math.min(sources.length, positiveInteger(process.env.KNOWLEDGE_CONTEXT_MAX_SOURCES, 8));
    const selected = sources.slice(0, sourceLimit);
    const perSourceBudget = Math.max(1_500, Math.floor(totalBudget / Math.max(selected.length, 1)));
    return selected.map((source) => ({
        name: source.name,
        content: String(source.extractedText || "").slice(0, perSourceBudget),
    })).filter((source) => source.content.trim());
};

export const withKnowledgeGenerationSlot = async <T>(operation: () => Promise<T>): Promise<T> => {
    const limit = positiveInteger(process.env.KNOWLEDGE_AI_MAX_CONCURRENCY, 4);
    if (activeGenerations >= limit) {
        throw createHttpError(429, "Knowledge generation is at capacity. Retry shortly.");
    }
    activeGenerations += 1;
    try {
        return await operation();
    } finally {
        activeGenerations -= 1;
    }
};
