import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import AIAgent from "../models/AIAgent.js";
import AIModel from "../models/AIModel.js";
import AIProvider from "../models/AIProvider.js";
import SecurityRole from "../models/SecurityRole.js";
import Workspace from "../models/Workspace.js";
import AIRoutingPolicy from "../models/AIRoutingPolicy.js";
import { resolveAIExecutionConfig } from "./aiExecution.js";
import { agentInputSchema, parseAIInput } from "./aiManagementValidation.js";
import { requestSettings } from "../core/ai-gateway/providers/vercel-gateway.provider.js";

const ids = { workspace: "111111111111111111111111", agent: "222222222222222222222222", model: "333333333333333333333333", role: "444444444444444444444444", provider: "555555555555555555555555" };
const setup = (context: TestContext) => {
    const state = {
        workspace: { _id: ids.workspace, defaultAiAgentId: ids.agent as string | null },
        agent: { _id: ids.agent, securityRoleId: ids.role, primaryModelId: ids.model, fallbackModelIds: [], systemPrompt: "Saved prompt", enabled: true, channels: ["web"], tools: ["knowledge-search", "conversation-context"], temperature: 0, maxOutputTokens: 500, timeoutMs: 12000 },
        model: { _id: ids.model, providerId: ids.provider, enabled: true, externalId: "saved-model", maxOutputTokens: 300, priority: 1 },
        provider: { _id: ids.provider, code: "google", enabled: true },
        role: { permissions: ["knowledge.use", "inbox.view"] },
    };
    const query = (read: () => unknown) => ({ lean: () => ({ exec: async () => read() }) });
    context.mock.method(Workspace, "findOne", () => query(() => state.workspace));
    context.mock.method(AIRoutingPolicy, "find", () => query(() => []));
    context.mock.method(AIAgent, "findOne", (filter: any) => {
        assert.equal(String(filter.workspaceId), ids.workspace);
        return query(() => state.agent);
    });
    context.mock.method(AIModel, "findById", () => query(() => state.model));
    context.mock.method(AIProvider, "findById", () => query(() => state.provider));
    context.mock.method(AIProvider, "findOne", () => query(() => null));
    context.mock.method(SecurityRole, "findOne", (filter: any) => {
        assert.equal(String(filter.$or[0].workspaceId), ids.workspace);
        return query(() => state.role);
    });
    return state;
};

test("dashboard settings override legacy provider, preserve zero, and clamp output to model capacity", async context => {
    const state = setup(context);
    const config = await resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web", providerName: "custom" });
    assert.equal(config.models[0].provider, "google");
    assert.equal(config.options.temperature, 0);
    assert.equal(config.options.maxTokens, 500);
    assert.equal(config.options.timeoutMs, 12000);
    assert.deepEqual(config.options.fallbackModels, []);
    assert.equal(config.systemPrompt, "Saved prompt");
    state.agent.systemPrompt = "Changed without restart";
    assert.equal((await resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web" })).systemPrompt, "Changed without restart");
});

test("disabled agents/providers/models and denied channels never fall back to environment", async context => {
    const state = setup(context);
    const run = () => resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web" });
    state.agent.enabled = false;
    await assert.rejects(run(), { statusCode: 403 });
    state.agent.enabled = true;
    state.model.enabled = false;
    await assert.rejects(run(), { statusCode: 403 });
    state.model.enabled = true;
    state.provider.enabled = false;
    await assert.rejects(run(), { statusCode: 403 });
    state.provider.enabled = true;
    await assert.rejects(resolveAIExecutionConfig({ systemSlug: "workspace", channel: "gmail" }), { statusCode: 403 });
});

test("context access requires both the capability and the current role permission", async context => {
    const state = setup(context);
    state.role.permissions = [];
    let config = await resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web" });
    assert.equal(config.allowKnowledge, false);
    assert.equal(config.allowHistory, false);
    state.role.permissions = ["knowledge.use", "inbox.view"];
    state.agent.tools = [];
    config = await resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web" });
    assert.equal(config.allowKnowledge, false);
    assert.equal(config.allowHistory, false);
    state.workspace.defaultAiAgentId = null;
    config = await resolveAIExecutionConfig({ systemSlug: "workspace", channel: "web", providerName: "custom" });
    assert.equal(config.agentId, undefined);
    assert.equal(config.models[0].provider, "custom");
});

test("agent input rejects missing prompts, unsupported tools, and invalid generation values", () => {
    const input = { name: "Agent", slug: "agent", securityRoleId: ids.role, primaryModelId: ids.model, systemPrompt: "Help", temperature: 0 };
    assert.equal(parseAIInput(agentInputSchema, input).temperature, 0);
    for (const change of [{ systemPrompt: "" }, { temperature: -1 }, { timeoutMs: 0 }, { tools: ["arbitrary-shell"] }, { enabled: "false" }]) {
        assert.throws(() => parseAIInput(agentInputSchema, { ...input, ...change }), { statusCode: 422 });
    }
});

test("managed Vercel settings suppress environment fallbacks and SDK retries", () => {
    const previous = process.env.AI_GATEWAY_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "test";
    try {
        const settings = requestSettings({ model: "saved/model", temperature: 0, maxTokens: 80, timeoutMs: 1000, maxRetries: 0, fallbackModels: [] });
        assert.equal(settings.temperature, 0);
        assert.equal(settings.maxOutputTokens, 80);
        assert.equal(settings.maxRetries, 0);
        assert.deepEqual(settings.providerOptions.gateway.models, []);
    } finally {
        if (previous === undefined) delete process.env.AI_GATEWAY_API_KEY;
        else process.env.AI_GATEWAY_API_KEY = previous;
    }
});
