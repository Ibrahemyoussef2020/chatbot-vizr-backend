import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AIAgent, AIModel, AIProvider, AIQuotaPolicy, AIRequestLog, AIRoutingPolicy, SecurityRole, Workspace } from "../models/index.js";
import { seedProductionAIManagement } from "./aiManagementProduction.seeder.js";
import { seedAIQuotaBaseline } from "./aiQuotaBaseline.seeder.js";
import { seedAITraffic } from "./aiTraffic.seeder.js";
import { getAIAnalyticsService, listAIRequestLogsService, getAIOverviewService, listAIQuotasService } from "../services/aiManagement.js";

test("production starter seed preserves settings, telemetry and tenant boundaries on reruns", async () => {
    const server = await MongoMemoryServer.create({
        binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") },
    });
    try {
        await mongoose.connect(server.getUri());
        const workspace = await Workspace.create({ name: "Brand", slug: "brand", ownerId: new mongoose.Types.ObjectId() });
        const other = await Workspace.create({ name: "Other", slug: "other", ownerId: new mongoose.Types.ObjectId() });
        const provider = await AIProvider.create({ code: "vercel", name: "Existing", keyEnvName: "AI_GATEWAY_API_KEY", enabled: false });
        await assert.rejects(seedProductionAIManagement(["brand", "missing"]), /Unknown workspaces/);
        assert.equal(await AIAgent.countDocuments(), 0);
        await seedProductionAIManagement(["brand"], { provider: "vercel", model: "test/model" });
        assert.equal(await AIAgent.countDocuments({ workspaceId: workspace._id }), 6);
        assert.equal(await AIAgent.countDocuments({ workspaceId: other._id }), 0);
        assert.equal(await AIAgent.countDocuments({ enabled: true }), 0);
        assert.equal(await AIRoutingPolicy.countDocuments({ enabled: true }), 0);
        assert.equal(await AIQuotaPolicy.countDocuments({ enabled: true }), 0);
        assert.equal(await AIRequestLog.countDocuments(), 0);
        assert.equal((await AIProvider.findById(provider._id))!.enabled, false);
        const agent = await AIAgent.findOne({ workspaceId: workspace._id }).orFail();
        agent.systemPrompt = "Keep the dashboard prompt";
        agent.temperature = 0;
        await agent.save();
        await Workspace.updateOne({ _id: workspace._id }, { defaultAiAgentId: agent._id });
        const collections = [AIAgent.collection, AIModel.collection, AIProvider.collection, AIQuotaPolicy.collection, AIRoutingPolicy.collection, SecurityRole.collection, Workspace.collection];
        const before = await Promise.all(collections.map(collection => collection.find().sort({ _id: 1 }).toArray()));
        await seedProductionAIManagement(["brand"], { provider: "vercel", model: "test/model" });
        const after = await Promise.all(collections.map(collection => collection.find().sort({ _id: 1 }).toArray()));
        assert.deepEqual(after, before);
        await AIRequestLog.create({ workspaceId: workspace._id, provider: "vercel", model: "test/model", requestType: "generate", status: "success", source: "runtime", correlationId: "real-request" });
        const realBefore = await AIRequestLog.findOne({ correlationId: "real-request" }).lean();
        const seeded = await seedAITraffic(["brand"], 1200);
        assert.equal(seeded[0].inserted, 1200);
        assert.equal((await seedAITraffic(["brand"], 1200))[0].inserted, 0);
        assert.equal(await AIRequestLog.countDocuments({ workspaceId: other._id }), 0);
        assert.deepEqual(await AIRequestLog.findOne({ correlationId: "real-request" }).lean(), realBefore);
        const user = { name: "Test", email: "test@example.invalid", id: String(workspace.ownerId), role: "super_admin" as const, workspaceId: String(workspace._id) };
        assert.equal((await getAIOverviewService(user, "brand", "runtime")).requests, 1);
        assert.equal((await getAIOverviewService(user, "brand", "demo")).requests, 1200);
        const analytics = await getAIAnalyticsService(user, "brand", "demo");
        assert.ok(analytics.daily.length >= 29);
        assert.equal(analytics.statuses.length, 3);
        assert.equal((await listAIRequestLogsService(user, "brand", "demo")).length, 200);
        assert.equal((await listAIRequestLogsService(user, "brand", "runtime")).length, 1);
        assert.equal((await getAIOverviewService(user, "brand")).requests, 1201);
        assert.equal((await listAIRequestLogsService(user, "brand")).length, 200);
        assert.equal((await getAIAnalyticsService(user, "brand")).statuses.reduce((sum, row) => sum + row.count, 0), 1201);
        assert.equal((await seedAIQuotaBaseline(["brand"])).inserted, 1);
        assert.equal((await seedAIQuotaBaseline(["brand"])).inserted, 0);
        const budget = await AIQuotaPolicy.findOne({ workspaceId: workspace._id }).orFail();
        assert.equal(budget.usedTokens, 0);
        await AIQuotaPolicy.updateOne({ _id: budget._id }, { runtimeInitialized: true, usedTokens: 20, resetAt: new Date(Date.now() + 60000) });
        const dashboardQuotas = await listAIQuotasService(user, "brand");
        assert.equal(dashboardQuotas[0].usedTokens, 570020);

    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
