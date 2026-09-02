import assert from "node:assert/strict";
import test from "node:test";
import { boundKnowledgeSources, withKnowledgeGenerationSlot } from "./knowledge-generation.policy.js";

test("knowledge context is bounded across selected sources", () => {
    const previousChars = process.env.KNOWLEDGE_CONTEXT_MAX_CHARS;
    const previousSources = process.env.KNOWLEDGE_CONTEXT_MAX_SOURCES;
    process.env.KNOWLEDGE_CONTEXT_MAX_CHARS = "6000";
    process.env.KNOWLEDGE_CONTEXT_MAX_SOURCES = "2";
    try {
        const result = boundKnowledgeSources([
            { name: "one", extractedText: "a".repeat(5000) },
            { name: "two", extractedText: "b".repeat(5000) },
            { name: "three", extractedText: "c".repeat(5000) },
        ]);
        assert.equal(result.length, 2);
        assert.equal(result.reduce((total, source) => total + source.content.length, 0), 6000);
    } finally {
        if (previousChars === undefined) delete process.env.KNOWLEDGE_CONTEXT_MAX_CHARS; else process.env.KNOWLEDGE_CONTEXT_MAX_CHARS = previousChars;
        if (previousSources === undefined) delete process.env.KNOWLEDGE_CONTEXT_MAX_SOURCES; else process.env.KNOWLEDGE_CONTEXT_MAX_SOURCES = previousSources;
    }
});

test("knowledge generation concurrency rejects excess work", async () => {
    const previous = process.env.KNOWLEDGE_AI_MAX_CONCURRENCY;
    process.env.KNOWLEDGE_AI_MAX_CONCURRENCY = "1";
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => { release = resolve; });
    const first = withKnowledgeGenerationSlot(() => blocker);
    await assert.rejects(() => withKnowledgeGenerationSlot(async () => undefined), /at capacity/);
    release();
    await first;
    if (previous === undefined) delete process.env.KNOWLEDGE_AI_MAX_CONCURRENCY; else process.env.KNOWLEDGE_AI_MAX_CONCURRENCY = previous;
});
