import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Subscription from "../models/Subscription.js";
import Plan from "../models/Plan.js";
import Workspace from "../models/Workspace.js";
import { listBusinessSubscriptions } from "./businessSubscriptions.js";

test("business subscription listing respects permissions and filters", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const ownerId = new mongoose.Types.ObjectId();
        const user = { id: String(ownerId), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["subscriptions.view"] };
        const workspace = await Workspace.create({ name: "Customer", slug: "customer", ownerId });
        const plan = await Plan.create({ code: "starter", name: "Starter" });
        await Subscription.create({ workspaceId: workspace._id, planId: plan._id, planCode: plan.code, provider: "stripe", status: "active", currentPeriodEnd: new Date(Date.now() + 86400000), providerCustomerId: "private-id" });
        await assert.rejects(() => listBusinessSubscriptions({ ...user, permissions: ["billing.view"] }, {}), { statusCode: 403 });
        const result = await listBusinessSubscriptions(user, { status: "active", limit: 1 });
        assert.equal(result.total, 1);
        assert.equal((result.items[0].workspaceId as unknown as { name: string }).name, "Customer");
        assert.equal(JSON.stringify(result).includes("private-id"), false);
        assert.equal((await listBusinessSubscriptions(user, { status: "expired" })).total, 0);
        assert.equal((await listBusinessSubscriptions(user, { search: ".*" })).total, 0);
        assert.equal((await listBusinessSubscriptions(user, { page: 2, limit: 1 })).items.length, 0);
        await assert.rejects(() => listBusinessSubscriptions(user, { page: 0 }), { statusCode: 422 });
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
