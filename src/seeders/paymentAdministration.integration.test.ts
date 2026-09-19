import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Plan, PaymentMethodConfig, PaymentTransaction, Subscription, Workspace } from "../models/index.js";
import { seedPaymentAdministration } from "./paymentAdministration.seeder.js";
import { listBusinessPlans } from "../services/plans/businessPlans.js";
import { listBusinessPayments } from "../services/payments/businessPayments.js";
import { listBusinessPaymentMethods } from "../services/payments/businessPaymentMethods.js";
import { listBusinessSubscriptions } from "../services/payments/businessSubscriptions.js";

test("payment seed populates four APIs, preserves existing records and is idempotent", { timeout: 120000 }, async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "payment-seed-test-"));
    const environmentFile = resolve(temporaryDirectory, "seed.env");
    try {
        await mongoose.connect(server.getUri());
        await writeFile(environmentFile, `MONGODB_URI=${server.getUri()}\nMONGODB_CONNECT_ATTEMPTS=1\n`);
        await Promise.all([Plan.init(), PaymentMethodConfig.init(), PaymentTransaction.init(), Subscription.init()]);
        const ownerId = new mongoose.Types.ObjectId();
        const workspace = await Workspace.create({ name: "Vizr", slug: "vizr", ownerId });
        await Workspace.create({ name: "Brand", slug: "brand-ecommerce", ownerId });
        const other = await Workspace.create({ name: "Private", slug: "private", ownerId });
        const existingPlan = await Plan.create({ code: "starter", name: "Custom Starter", pricing: { monthly: 52, yearly: 520 } });
        const existingMethod = await PaymentMethodConfig.create({ provider: "stripe", label: "Custom Stripe", isEnabled: true, isTestMode: false, credentials: { secretKey: "preserve-secret" } });
        const existingSubscription = await Subscription.create({ workspaceId: workspace._id, planId: existingPlan._id, planCode: "starter", provider: "stripe", currentPeriodEnd: new Date(Date.now() + 86400000), status: "active" });
        const snapshot = async () => Promise.all([
            Plan.find().sort({ _id: 1 }).lean().exec(),
            PaymentMethodConfig.find().sort({ _id: 1 }).lean().exec(),
            PaymentTransaction.find().sort({ _id: 1 }).lean().exec(),
            Subscription.find().sort({ _id: 1 }).lean().exec(),
        ]);

        const before = await snapshot();
        const cli = promisify(execFile);
        const preview = await cli(process.execPath, [
            "--import", "tsx", "src/seeders/paymentAdministration.ts",
            "--env-file", environmentFile, "--workspace", "vizr",
        ], { timeout: 20000 });
        assert.match(preview.stdout, /"mode":"preview"/);
        assert.deepEqual(await snapshot(), before);
        await assert.rejects(() => seedPaymentAdministration(["vizr", "missing"]), /Unknown workspaces/);
        assert.deepEqual(await snapshot(), before);
        await assert.rejects(() => seedPaymentAdministration([]), /Select at least one workspace/);
        const first = await seedPaymentAdministration(["vizr", "brand-ecommerce", "vizr"]);
        assert.deepEqual(first.inserted, { pricings: 3, paymentMethods: 1, payments: 12, subscriptions: 4 });
        assert.deepEqual(await Plan.findById(existingPlan._id).lean().exec(), before[0][0]);
        assert.deepEqual(await PaymentMethodConfig.findById(existingMethod._id).lean().exec(), before[1][0]);
        assert.deepEqual(await Subscription.findById(existingSubscription._id).lean().exec(), before[3][0]);
        assert.equal(await Subscription.countDocuments({ workspaceId: workspace._id, status: "active" }), 1);
        assert.equal(await Subscription.countDocuments({ workspaceId: other._id }), 0);
        assert.equal(await PaymentTransaction.countDocuments({ workspaceId: other._id }), 0);
        assert.equal(await PaymentTransaction.countDocuments({ providerRef: null }), 0);
        assert.equal(await PaymentTransaction.countDocuments({ amount: 52 }), 12);
        const sampleSubscriptions = await Subscription.find({ provider: "seed" }).lean().exec();
        assert.ok(sampleSubscriptions.every(item => ["expired", "canceled"].includes(item.status) && item.currentPeriodEnd < new Date()));
        const after = await snapshot();
        const second = await seedPaymentAdministration(["vizr", "brand-ecommerce"]);
        assert.deepEqual(second.inserted, { pricings: 0, paymentMethods: 0, payments: 0, subscriptions: 0 });
        assert.deepEqual(await snapshot(), after);

        const user = { id: String(ownerId), name: "Owner", email: "owner@example.test", role: "super_admin" as const,
            permissions: ["plans.manage", "payments.view", "payment_methods.manage", "subscriptions.view"] };
        assert.equal((await listBusinessPlans(user)).length, 4);
        assert.equal((await listBusinessPayments(user, {})).total, 12);
        assert.equal((await listBusinessPayments(user, { status: "awaiting_review" })).total, 2);
        const methods = await listBusinessPaymentMethods(user);
        assert.equal(methods.length, 2);
        assert.equal(methods.find(item => item.provider === "vodafone_cash")?.isEnabled, false);
        assert.equal(JSON.stringify(methods).includes("preserve-secret"), false);
        assert.equal((await listBusinessSubscriptions(user, {})).total, 5);
        await assert.rejects(() => Subscription.create({
            workspaceId: workspace._id, planId: existingPlan._id, planCode: "starter",
            provider: "stripe", status: "trialing", currentPeriodEnd: new Date(Date.now() + 86400000),
        }), { code: 11000 });
        const applied = await cli(process.execPath, [
            "--import", "tsx", "src/seeders/paymentAdministration.ts",
            "--env-file", environmentFile, "--workspace", "vizr", "--workspace", "brand-ecommerce", "--apply",
        ], { timeout: 20000 });
        assert.match(applied.stdout, /"mode":"apply"/);
        assert.deepEqual(await snapshot(), after);
    } finally {
        await mongoose.disconnect();
        await server.stop();
        await unlink(environmentFile).catch(() => undefined);
        await rmdir(temporaryDirectory);
    }
});
