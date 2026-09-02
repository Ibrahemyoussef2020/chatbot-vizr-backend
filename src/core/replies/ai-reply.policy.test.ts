import assert from "node:assert/strict";
import test from "node:test";
import type { ModelMessage } from "ai";
import { boundChatHistory, relevantKnowledgeExcerpt, withAiReplySlot } from "./ai-reply.policy.js";

test("chat history keeps the newest content inside its budget", () => {
    const previous = process.env.CHAT_AI_MAX_HISTORY_CHARS;
    process.env.CHAT_AI_MAX_HISTORY_CHARS = "6";
    try {
        const result = boundChatHistory([{ role: "user", content: "old" }, { role: "assistant", content: "newest" }] as ModelMessage[]);
        assert.deepEqual(result, [{ role: "assistant", content: "newest" }]);
    } finally {
        if (previous === undefined) delete process.env.CHAT_AI_MAX_HISTORY_CHARS; else process.env.CHAT_AI_MAX_HISTORY_CHARS = previous;
    }
});

test("knowledge excerpt centers on a relevant term", () => {
    const excerpt = relevantKnowledgeExcerpt(`${"x".repeat(100)} refund policy is thirty days ${"y".repeat(100)}`, ["refund"], 60);
    assert.match(excerpt, /refund policy/);
});

test("chat concurrency rejects excess replies", async () => {
    const previous = process.env.CHAT_AI_MAX_CONCURRENCY;
    process.env.CHAT_AI_MAX_CONCURRENCY = "1";
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => { release = resolve; });
    const first = withAiReplySlot(() => blocker);
    await assert.rejects(() => withAiReplySlot(async () => undefined), /busy/);
    release();
    await first;
    if (previous === undefined) delete process.env.CHAT_AI_MAX_CONCURRENCY; else process.env.CHAT_AI_MAX_CONCURRENCY = previous;
});
