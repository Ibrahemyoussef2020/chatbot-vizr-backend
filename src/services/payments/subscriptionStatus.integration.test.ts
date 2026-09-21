import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { PaymentTransaction, Subscription, Workspace } from "../../models/index.js";
import { getWorkspaceSubscriptionStatus } from "./subscription.js";

test("subscription status keeps paid workspaces in dashboard while payment is pending and activates after confirmation", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        await Promise.all([Workspace.init(), PaymentTransaction.init(), Subscription.init()]);
        const ownerId = new mongoose.Types.ObjectId();
        const workspace = await Workspace.create({
            name: "Pending workspace",
            slug: "pending-workspace",
            businessName: "Pending workspace",
            selectedPlanCode: "starter",
            ownerId,
        });
        const transaction = await PaymentTransaction.create({
            reference: "PAY-PENDING-1",
            workspaceId: workspace._id,
            userId: ownerId,
            planId: new mongoose.Types.ObjectId(),
            planCode: "starter",
            provider: "vodafone_cash",
            billingCycle: "monthly",
            amount: 29,
            currency: "USD",
            status: "awaiting_review",
        });
        const user = { id: String(ownerId), name: "Owner", email: "owner@test.local", role: "admin" as const, permissions: [], workspaceId: String(workspace._id) };

        const pending = await getWorkspaceSubscriptionStatus(user);
        assert.equal(pending.active, false);
        assert.equal(pending.pending, true);
        assert.equal(pending.paymentStatus, "awaiting_review");
        assert.equal(pending.paymentReference, transaction.reference);

        transaction.status = "succeeded";
        await transaction.save();
        const awaitingActivation = await getWorkspaceSubscriptionStatus(user);
        assert.equal(awaitingActivation.pending, true);
        assert.equal(awaitingActivation.paymentStatus, "succeeded");

        await Subscription.create({
            workspaceId: workspace._id,
            planId: transaction.planId,
            planCode: "starter",
            status: "active",
            billingCycle: "monthly",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            provider: "vodafone_cash",
        });
        const active = await getWorkspaceSubscriptionStatus(user);
        assert.equal(active.active, true);
        assert.equal(active.pending, false);
        assert.equal(active.planCode, "starter");
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
