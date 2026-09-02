import assert from "node:assert/strict";
import test from "node:test";
import { resolveKnowledgeGatewayConfig } from "./vercel-knowledge-output.provider.js";

test("knowledge gateway configuration uses explicit models and removes primary duplicates", () => {
    const previous = { key: process.env.AI_GATEWAY_API_KEY, model: process.env.KNOWLEDGE_AI_MODEL, fallbacks: process.env.KNOWLEDGE_AI_FALLBACK_MODELS };
    process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
    process.env.KNOWLEDGE_AI_MODEL = "provider/primary";
    process.env.KNOWLEDGE_AI_FALLBACK_MODELS = "provider/primary, provider/fallback";
    try {
        assert.deepEqual(resolveKnowledgeGatewayConfig(), { apiKey: "gateway-test-key", primary: "provider/primary", fallbacks: ["provider/fallback"] });
    } finally {
        if (previous.key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = previous.key;
        if (previous.model === undefined) delete process.env.KNOWLEDGE_AI_MODEL; else process.env.KNOWLEDGE_AI_MODEL = previous.model;
        if (previous.fallbacks === undefined) delete process.env.KNOWLEDGE_AI_FALLBACK_MODELS; else process.env.KNOWLEDGE_AI_FALLBACK_MODELS = previous.fallbacks;
    }
});

test("knowledge gateway configuration requires gateway authentication", () => {
    const previous = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try { assert.throws(() => resolveKnowledgeGatewayConfig(), /Missing AI_GATEWAY_API_KEY/); }
    finally { if (previous !== undefined) process.env.AI_GATEWAY_API_KEY = previous; }
});
