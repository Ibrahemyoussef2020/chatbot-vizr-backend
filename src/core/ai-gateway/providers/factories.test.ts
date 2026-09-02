import assert from "node:assert/strict";
import test from "node:test";
import { resolveOpenAIKey } from "./factories.js";

const withKeys = (standard: string | undefined, legacy: string | undefined, assertion: () => void) => {
    const previousStandard = process.env.OPENAI_API_KEY;
    const previousLegacy = process.env.OPEN_AI_SECRET_KEY;
    if (standard === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = standard;
    if (legacy === undefined) delete process.env.OPEN_AI_SECRET_KEY; else process.env.OPEN_AI_SECRET_KEY = legacy;
    try { assertion(); } finally {
        if (previousStandard === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousStandard;
        if (previousLegacy === undefined) delete process.env.OPEN_AI_SECRET_KEY; else process.env.OPEN_AI_SECRET_KEY = previousLegacy;
    }
};

test("OpenAI key resolver rejects application placeholders", () => {
    withKeys("AI_Chatbot_API_Key", "placeholder-key", () => assert.equal(resolveOpenAIKey(), undefined));
});

test("OpenAI key resolver prefers a valid standard key", () => {
    withKeys("sk-project-test-value", "sk-legacy-test-value", () => assert.equal(resolveOpenAIKey(), "sk-project-test-value"));
});
