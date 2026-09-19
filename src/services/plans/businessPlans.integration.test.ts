import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Plan from "../../models/Plan.js";
import Subscription from "../../models/Subscription.js";
import { listBusinessPlans, saveBusinessPlan, deleteBusinessPlan } from "./businessPlans.js";

test("business plan CRUD validates pricing, permissions and subscription references", { timeout: 120000 }, async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        await Plan.init();
        const owner = { id: String(new mongoose.Types.ObjectId()), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["plans.manage"] };
        const tenant = { ...owner, role: "admin" as const, permissions: ["billing.manage"] };
        const input = { code: "starter", name: "Starter", currency: "USD", pricing: { monthly: 29, yearly: 290 }, status: "draft", visibility: "public" };
        for (const action of [
            () => listBusinessPlans(tenant),
            () => saveBusinessPlan(tenant, input),
            () => deleteBusinessPlan(tenant, String(new mongoose.Types.ObjectId())),
        ]) {
            await assert.rejects(action, { statusCode: 403 });
        }
        await assert.rejects(() => saveBusinessPlan(owner, { ...input, pricing: { monthly: -1, yearly: 290 } }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessPlan(owner, { ...input, workspaceId: owner.id }), { statusCode: 422 });
        const created = await saveBusinessPlan(owner, input);
        const id = String(created._id);
        await assert.rejects(() => saveBusinessPlan(owner, input), { statusCode: 409 });
        const updated = await saveBusinessPlan(owner, { ...input, pricing: { monthly: 0, yearly: null }, status: "published" }, id);
        assert.deepEqual(updated.pricing, { monthly: 0, yearly: null });
        assert.equal((await listBusinessPlans(owner)).length, 1);
        await Subscription.create({ workspaceId: new mongoose.Types.ObjectId(), planId: created._id, planCode: "starter", provider: "test", currentPeriodEnd: new Date(Date.now() + 86400000) });
        await assert.rejects(() => deleteBusinessPlan(owner, id), { statusCode: 409 });
        await assert.rejects(() => saveBusinessPlan(owner, { ...input, code: "renamed" }, id), { statusCode: 409 });
        await saveBusinessPlan(owner, { ...input, status: "archived" }, id);
        await Subscription.deleteMany({});
        await deleteBusinessPlan(owner, id);
        assert.equal((await listBusinessPlans(owner)).length, 0);
        await assert.rejects(() => deleteBusinessPlan(owner, id), { statusCode: 404 });
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
