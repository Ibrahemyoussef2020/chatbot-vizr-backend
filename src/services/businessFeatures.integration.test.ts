import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import AIAgent from "../models/AIAgent.js";
import PlanFeature from "../models/PlanFeature.js";
import Plan from "../models/Plan.js";
import User from "../models/User.js";
import SecurityRole from "../models/SecurityRole.js";
import workspaceRouter from "../routers/workspace.js";
import { deleteBusinessFeature, featureOptions, listBusinessFeatures, saveBusinessFeature } from "./businessFeatures.js";
import { saveBusinessPlan } from "./businessPlans.js";

test("feature catalog validates quotas, agent references, permissions and plan references", { timeout: 120000 }, async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        await Promise.all([PlanFeature.init(), Plan.init()]);
        const owner = { id: String(new mongoose.Types.ObjectId()), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["plans.manage"] };
        const tenant = { ...owner, permissions: [] };
        const input = { code: "assistant", name: "Assistant", quotas: { "tokens.monthly": 50000 }, agentSlugs: ["support"] };
        await AIAgent.create({ workspaceId: new mongoose.Types.ObjectId(), securityRoleId: new mongoose.Types.ObjectId(), name: "Support", slug: "support", systemPrompt: "Help" });
        for (const action of [() => listBusinessFeatures(tenant), () => featureOptions(tenant), () => saveBusinessFeature(tenant, input), () => deleteBusinessFeature(tenant, owner.id)]) {
            await assert.rejects(action, { statusCode: 403 });
        }
        await assert.rejects(() => saveBusinessFeature(owner, { ...input, quotas: { invented: 1 } }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessFeature(owner, { ...input, quotas: { "tokens.monthly": -2 } }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessFeature(owner, { ...input, agentSlugs: ["missing"] }), { statusCode: 422 });
        const feature = await saveBusinessFeature(owner, input);
        const id = String(feature._id);
        const role = await SecurityRole.create({ name: "Feature manager", code: "feature_manager", scope: "business", permissions: ["plans.manage"] });
        const principal = await User.create({ name: "Route tester", email: "route@test.local", password: "unused", role: "super_admin", securityRoleId: role._id });
        const token = jwt.sign({ userInfo: { id: String(principal._id) } }, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "default_access_token_secret");
        const app = express();
        app.use("/api/admin", workspaceRouter);
        const listener = app.listen(0, "127.0.0.1");
        try {
            await new Promise<void>(resolve => listener.once("listening", resolve));
            const address = listener.address();
            assert.ok(address && typeof address !== "string");
            const base = `http://127.0.0.1:${address.port}/api/admin/pricings-features`;
            const response = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(response.status, 200);
            assert.equal((await response.json()).data[0]._id, id);
            const optionsResponse = await fetch(`${base}/options`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(optionsResponse.status, 200);
            assert.equal((await optionsResponse.json()).data.agents[0].slug, "support");
        } finally {
            await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        }
        assert.equal((await listBusinessFeatures(owner))[0]?.quotas?.["tokens.monthly"], 50000);
        await assert.rejects(() => saveBusinessFeature(owner, input), { statusCode: 409 });
        const planInput = { code: "starter", name: "Starter", currency: "USD", pricing: { monthly: 10, yearly: 100 }, status: "draft", visibility: "public", featureIds: [id] };
        await assert.rejects(() => saveBusinessPlan(owner, { ...planInput, featureIds: [owner.id] }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessPlan(owner, { ...planInput, featureIds: [id, id] }), { statusCode: 422 });
        const plan = await saveBusinessPlan(owner, planInput);
        assert.deepEqual(plan.features, ["Assistant"]);
        await assert.rejects(() => deleteBusinessFeature(owner, id), { statusCode: 409 });
        await assert.rejects(() => saveBusinessFeature(owner, { ...input, code: "changed" }, id), { statusCode: 409 });
        await saveBusinessFeature(owner, { ...input, quotas: { "tokens.monthly": -1 } }, id);
        await saveBusinessPlan(owner, { ...planInput, featureIds: [] }, String(plan._id));
        await deleteBusinessFeature(owner, id);
        assert.equal((await listBusinessFeatures(owner)).length, 0);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
