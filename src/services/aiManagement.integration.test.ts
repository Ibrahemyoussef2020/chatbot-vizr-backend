import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AIAgent, AIModel, AIProvider, AIQuotaPolicy, AIRequestLog, Conversation, Message, SecurityRole, Workspace, KnowledgeSource } from "../models/index.js";
import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";
import { runAIGateway } from "./aiGateway.js";
import { saveAIAgentService, saveAIRuntimeService, saveAIRoutingService, saveAIQuotaService, updateAIProviderService, deleteAIModelService } from "./aiManagement.js";
import type { AuthenticatedUserContext } from "./workspaces.js";

test("dashboard configuration governs generation and streaming with real persistence", { timeout: 900000 }, async context => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const workspace = await Workspace.create({ name: "Integration", slug: "integration", ownerId: new mongoose.Types.ObjectId() });
        const other = await Workspace.create({ name: "Other", slug: "other", ownerId: new mongoose.Types.ObjectId() });
        const user: AuthenticatedUserContext = {
            id: new mongoose.Types.ObjectId().toString(), name: "Admin", email: "admin@example.test", role: "admin",
            workspaceId: String(workspace._id), permissions: ["inbox.view", "ai.agents.manage", "ai.providers.manage"],
        };
        const role = await SecurityRole.create({ name: "Reply", code: "reply", workspaceId: workspace._id, scope: "workspace", permissions: [] });
        const provider = await AIProvider.create({ code: "integration", name: "Fake provider", keyEnvName: "INTEGRATION_TEST_KEY" });
        const primary = await AIModel.create({ providerId: provider._id, externalId: "primary", displayName: "Primary", maxOutputTokens: 100 });
        const fallback = await AIModel.create({ providerId: provider._id, externalId: "fallback", displayName: "Fallback", maxOutputTokens: 80 });
        const agent = await saveAIAgentService(user, workspace.slug, {
            name: "Support", slug: "support", securityRoleId: String(role._id), primaryModelId: String(primary._id),
            fallbackModelIds: [String(fallback._id)], systemPrompt: "Saved agent instructions", temperature: 0,
            channels: ["web"], tools: [],
        });
        await saveAIRuntimeService(user, workspace.slug, { defaultAgentId: String(agent._id) });
        await saveAIQuotaService(user, workspace.slug, { name: "Daily", scope: "workspace", period: "day", requestLimit: 20, tokenLimit: 100000, concurrencyLimit: 2 });
        const conversation = await Conversation.create({ publicId: "integration-thread", sessionTokenHash: "test-only", systemSlug: workspace.slug, receivedFrom: "web", visitor: { name: "Customer" } });
        await Message.create({ conversationId: conversation._id, receivedFrom: "web", senderType: "visitor", content: "Old private context", createdAt: new Date(0) });
        await Message.create({ conversationId: conversation._id, receivedFrom: "web", senderType: "visitor", content: "Current question" });
        const request = { provider: "custom", prompt: "Client override", options: { threadId: conversation.publicId, systemSlug: workspace.slug, systemPrompt: "Client override", temperature: 2 } };
        const calls: string[] = [];
        AIFactory.registerProvider("integration", {
            generate: async (history, options) => {
                calls.push(options?.model ?? "unknown");
                assert.equal(options?.temperature, 0);
                assert.match(options?.systemPrompt ?? "", /Saved agent instructions/);
                assert.doesNotMatch(options?.systemPrompt ?? "", /Client override/);
                assert.deepEqual(history, [{ role: "user", content: "Current question" }]);
                if (options?.model === "primary") throw new Error("Fake upstream failure");
                assert.equal(options.maxTokens, 80);
                options.onUsage?.({ inputTokens: 20, outputTokens: 10 });
                return "Managed answer";
            },
            stream: async (_history, _response, options) => {
                options?.onUsage?.({ inputTokens: 10, outputTokens: 5 });
            },
        });

        await context.test("saved defaults win over client options and fallback reconciles quotas", async child => {
            assert.equal(await runAIGateway(user, request), "Managed answer");
            assert.deepEqual(calls, ["primary", "fallback"]);
            const logs = await AIRequestLog.find({ source: "runtime" }).sort({ createdAt: 1 }).lean();
            assert.equal(logs.length, 2);
            assert.equal(logs[1].totalTokens, 30);
            assert.equal(logs[1].status, "fallback");
            const quota = await AIQuotaPolicy.findOne({ workspaceId: workspace._id }).lean();
            assert.equal(quota?.usedRequests, 2);
            assert.equal(quota?.leases.length, 0);
        });

        await context.test("streaming stays inside the same resolver and holds quota until completion", async () => {
            let ran = false;
            await runAIGateway(user, request, {
                isCommitted: () => false,
                run: async (selectedProvider, history, options) => {
                    assert.equal(options.model, "primary");
                    assert.equal((await AIQuotaPolicy.findOne({ workspaceId: workspace._id }).lean())?.leases.length, 1);
                    await selectedProvider.stream(history, {} as never, options);
                    ran = true;
                    return "";
                },
            });
            assert.equal(ran, true);
            assert.equal(await AIRequestLog.countDocuments({ requestType: "stream", source: "runtime" }), 1);
            assert.equal((await AIQuotaPolicy.findOne({ workspaceId: workspace._id }).lean())?.leases.length, 0);
        });

        await context.test("committed streams never retry into a second response", async () => {
            let attempts = 0;
            await assert.rejects(runAIGateway(user, request, {
                isCommitted: () => true,
                run: async () => { attempts += 1; throw new Error("Stream interrupted"); },
            }), /Stream interrupted/);
            assert.equal(attempts, 1);
        });

        await context.test("tenant boundaries, raw-request bypasses, and global mutations are rejected", async () => {
            await assert.rejects(runAIGateway(user, { ...request, options: { ...request.options, systemSlug: other.slug } }), { statusCode: 403 });
            await assert.rejects(runAIGateway(user, { prompt: "Bypass assigned agent" }), { statusCode: 422 });
            await assert.rejects(updateAIProviderService(String(provider._id), { enabled: false }, user), { statusCode: 403 });
            await assert.rejects(saveAIRuntimeService({ ...user, workspaceId: String(other._id) }, other.slug, { defaultAgentId: String(agent._id) }), { statusCode: 422 });
            await assert.rejects(saveAIRoutingService({ ...user, workspaceId: String(other._id) }, other.slug, { name: "Wrong tenant", agentId: String(agent._id), modelIds: [String(primary._id)] }), { statusCode: 422 });
            await assert.rejects(deleteAIModelService(String(primary._id), { ...user, permissions: ["business.manage", "ai.models.manage"] }), { statusCode: 409 });
        });

        await context.test("turning off the assigned agent blocks the next request without fallback", async () => {
            await AIAgent.updateOne({ _id: agent._id }, { $set: { enabled: false } });
            const before = calls.length;
            await assert.rejects(runAIGateway(user, request), { statusCode: 403 });
            assert.equal(calls.length, before);
        });
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
