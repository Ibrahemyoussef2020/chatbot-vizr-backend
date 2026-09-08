import assert from "node:assert/strict";
import test from "node:test";
import AIRequestLog from "../models/AIRequestLog.js";
import AIProvider from "../models/AIProvider.js";
import AIQuotaPolicy from "../models/AIQuotaPolicy.js";
import AIRoutingPolicy from "../models/AIRoutingPolicy.js";
import { orderRoutingModels } from "./aiRouting.js";
import { generateAIReply, type AIExecutionConfig, type ExecutionModel } from "./aiExecution.js";
import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";

const workspaceId = "111111111111111111111111";
const models: ExecutionModel[] = ["first", "second", "third"].map(provider => ({
    id: "", providerId: "", provider, externalId: provider, priority: 100, maxOutputTokens: 50,
}));

test("priority preserves explicit order and round robin rotates using persistent sequence", async context => {
    assert.deepEqual(await orderRoutingModels(models, { _id: "policy", strategy: "priority" }, workspaceId), models);
    context.mock.method(AIRoutingPolicy, "findOneAndUpdate", () => ({ lean: () => ({ exec: async () => ({ nextSequence: 2 }) }) }));
    const ordered = await orderRoutingModels(models, { _id: "policy", strategy: "round_robin" }, workspaceId);
    assert.deepEqual(ordered.map(model => model.provider), ["second", "third", "first"]);
});

test("adaptive routing uses only runtime telemetry", async context => {
    context.mock.method(AIRequestLog, "aggregate", (pipeline: any[]) => {
        assert.equal(pipeline[0].$match.source, "runtime");
        return [{ _id: { provider: "first", model: "first" }, requests: 20, latency: 100 }];
    });
    const ordered = await orderRoutingModels(models, { _id: "policy", strategy: "least_used" }, workspaceId);
    assert.equal(ordered[0].provider, "second");
});

test("lowest latency selects the faster measured model", async context => {
    context.mock.method(AIRequestLog, "aggregate", () => models.map((model, index) => ({
        _id: { provider: model.provider, model: model.externalId },
        requests: 10,
        latency: [800, 100, 500][index],
    })));
    const ordered = await orderRoutingModels(models, { _id: "policy", strategy: "lowest_latency" }, workspaceId);
    assert.equal(ordered[0].provider, "second");
});

test("quota-aware routing avoids exhausted budgets and ignores demo counters", async context => {
    const quota = {
        scope: "model", scopeId: "first", runtimeInitialized: true,
        requestLimit: 10, usedRequests: 10, tokenLimit: 0, usedTokens: 0,
        concurrencyLimit: 1, leases: [], resetAt: new Date(Date.now() + 60000),
    };
    context.mock.method(AIQuotaPolicy, "find", () => ({ lean: () => ({ exec: async () => [quota] }) }));
    const candidates = models.map(model => ({ ...model, id: model.provider }));
    const policy = { _id: "policy", strategy: "quota_aware" };
    assert.equal((await orderRoutingModels(candidates, policy, workspaceId))[0].provider, "second");
    quota.runtimeInitialized = false;
    assert.equal((await orderRoutingModels(candidates, policy, workspaceId))[0].provider, "first");
});

test("fallback follows configured models, clamps each output limit, and records real usage", async context => {
    context.mock.method(AIQuotaPolicy, "find", () => ({ sort: () => ({ lean: () => ({ exec: async () => [] }) }) }));
    const calls: string[] = [];
    const logs: any[] = [];
    context.mock.method(AIProvider, "findOne", () => ({ select: () => ({ lean: () => ({ exec: async () => null }) }) }));
    context.mock.method(AIRequestLog, "create", async (record: any) => { logs.push(record); });
    for (const model of models) {
        AIFactory.registerProvider(model.provider, {
            generate: async (_prompt, options) => {
                calls.push(model.provider);
                assert.equal(options?.maxTokens, 50);
                assert.equal(options?.maxRetries, 0);
                if (model.provider === "first") throw new Error("upstream failed");
                options?.onUsage?.({ inputTokens: 10, outputTokens: 20 });
                return "reply";
            },
            stream: async () => {},
        });
    }
    const config: AIExecutionConfig = {
        workspaceId, agentId: "222222222222222222222222", models,
        allowHistory: false, allowKnowledge: false,
        options: { maxTokens: 100, maxRetries: 1, timeoutMs: 10000, fallbackModels: [] },
    };
    assert.equal(await generateAIReply(config, [], "prompt"), "reply");
    assert.deepEqual(calls, ["first", "second"]);
    assert.equal(logs[1].status, "fallback");
    assert.equal(logs[1].totalTokens, 30);
    calls.length = 0;
    await assert.rejects(generateAIReply({ ...config, options: { ...config.options, maxRetries: 0 } }, [], "prompt"), { statusCode: 502 });
    assert.deepEqual(calls, ["first"]);
});
