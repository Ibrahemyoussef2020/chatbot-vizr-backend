import type { ModelMessage } from "ai";
import { createHttpError } from "../shared/errors/HttpError.js";

let activeReplies = 0;

const positiveInteger = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const boundChatHistory = (messages: ModelMessage[]): ModelMessage[] => {
    let remaining = positiveInteger(process.env.CHAT_AI_MAX_HISTORY_CHARS, 24_000);
    const bounded: ModelMessage[] = [];
    for (const message of [...messages].reverse()) {
        if (remaining <= 0) break;
        if (typeof message.content !== "string") {
            bounded.push(message);
            continue;
        }
        const content = message.content.slice(-remaining);
        remaining -= content.length;
        bounded.push({ ...message, content } as ModelMessage);
    }
    return bounded.reverse();
};

export const relevantKnowledgeExcerpt = (text: string, terms: string[], maxChars: number) => {
    if (maxChars <= 0) return "";
    const normalized = text.toLowerCase();
    const positions = terms.map((term) => normalized.indexOf(term)).filter((position) => position >= 0);
    const match = positions.length ? Math.min(...positions) : 0;
    const start = Math.max(0, match - Math.floor(maxChars * 0.2));
    return text.slice(start, start + maxChars);
};

export const withAiReplySlot = async <T>(operation: () => Promise<T>): Promise<T> => {
    const limit = positiveInteger(process.env.CHAT_AI_MAX_CONCURRENCY, 20);
    if (activeReplies >= limit) throw createHttpError(429, "Customer chat is busy. Retry shortly.");
    activeReplies += 1;
    try { return await operation(); }
    finally { activeReplies -= 1; }
};
