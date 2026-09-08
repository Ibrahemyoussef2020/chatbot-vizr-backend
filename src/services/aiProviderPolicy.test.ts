import assert from "node:assert/strict";
import test from "node:test";
import AIProvider from "../models/AIProvider.js";
import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";
import { assertAIProviderEnabled } from "./aiProviderPolicy.js";

test("saved provider switches govern existing handles and both execution modes", async (context) => {
    let enabled = true;
    let calls = 0;
    context.mock.method(AIProvider, "findOne", () => ({
        select: () => ({ lean: () => ({ exec: async () => ({ enabled }) }) }),
    }));
    AIFactory.registerProvider("policy-test", {
        generate: async () => { calls += 1; return "ok"; },
        stream: async () => { calls += 1; },
    });
    const provider = AIFactory.getProvider("policy-test");
    assert.equal(await provider.generate("hello"), "ok");
    enabled = false;
    await assert.rejects(provider.generate("hello"), { statusCode: 403 });
    await assert.rejects(provider.stream([], {} as never), { statusCode: 403 });
    assert.equal(calls, 1);
    enabled = true;
    await provider.stream([], {} as never);
    assert.equal(calls, 2);
});

test("missing catalog records preserve legacy defaults; database failures do not", async (context) => {
    const query = context.mock.method(AIProvider, "findOne", () => ({
        select: () => ({ lean: () => ({ exec: async () => null }) }),
    }));
    await assertAIProviderEnabled("legacy");
    query.mock.mockImplementation(() => { throw new Error("database unavailable"); });
    await assert.rejects(assertAIProviderEnabled("legacy"), /database unavailable/);
});
