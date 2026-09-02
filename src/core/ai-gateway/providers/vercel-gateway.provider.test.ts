import assert from "node:assert/strict";
import test from "node:test";
import { resolveChatGatewayConfig } from "./vercel-gateway.provider.js";

test("chat gateway resolves primary and fallback models", () => {
    const previous = { key: process.env.AI_GATEWAY_API_KEY, primary: process.env.CHAT_AI_MODEL, fallbacks: process.env.CHAT_AI_FALLBACK_MODELS };
    process.env.AI_GATEWAY_API_KEY = "gateway-test-key";
    process.env.CHAT_AI_MODEL = "provider/primary";
    process.env.CHAT_AI_FALLBACK_MODELS = "provider/primary,provider/fallback";
    try {
        assert.deepEqual(resolveChatGatewayConfig(), { apiKey: "gateway-test-key", primary: "provider/primary", fallbacks: ["provider/fallback"] });
    } finally {
        if (previous.key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = previous.key;
        if (previous.primary === undefined) delete process.env.CHAT_AI_MODEL; else process.env.CHAT_AI_MODEL = previous.primary;
        if (previous.fallbacks === undefined) delete process.env.CHAT_AI_FALLBACK_MODELS; else process.env.CHAT_AI_FALLBACK_MODELS = previous.fallbacks;
    }
});

test("chat gateway requires an AI Gateway key", () => {
    const previous = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try { assert.throws(() => resolveChatGatewayConfig(), /Missing AI_GATEWAY_API_KEY/); }
    finally { if (previous !== undefined) process.env.AI_GATEWAY_API_KEY = previous; }
});
