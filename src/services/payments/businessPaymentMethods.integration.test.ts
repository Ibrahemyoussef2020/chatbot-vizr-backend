import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import PaymentMethodConfig from "../../models/PaymentMethodConfig.js";
import WorkspacePaymentMethodConfig from "../../models/WorkspacePaymentMethodConfig.js";
import { listCheckoutPaymentMethods } from "./businessPaymentMethods.js";
import { listBusinessPaymentMethods, saveBusinessPaymentMethod } from "./businessPaymentMethods.js";

test("method configuration uses registered providers and hides credentials", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const user = { id: String(new mongoose.Types.ObjectId()), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["payment_methods.manage"] };
        const otherWorkspaceUser = { ...user, workspaceId: String(new mongoose.Types.ObjectId()) };
        const input = { label: "Wallet", isEnabled: true, isTestMode: false, sortOrder: 1, instructions: "Send transfer", supportedCurrencies: ["EGP"], settings: { walletNumber: "01012345678", holderName: "Owner" } };
        await assert.rejects(() => saveBusinessPaymentMethod({ ...user, role: "admin" as const, permissions: [] }, "vodafone_cash", input), { statusCode: 403 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "unknown", input), { statusCode: 404 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, settings: {} }));
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, settings: { ...input.settings, feePercent: 101 } }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, supportedCurrencies: ["EUR"] }), { statusCode: 422 });
        const saved = await saveBusinessPaymentMethod(user, "vodafone_cash", input);
        assert.equal(saved?.isEnabled, true);
        const savedFromDifferentWorkspace = await saveBusinessPaymentMethod(otherWorkspaceUser, "vodafone_cash", { ...input, label: "Shared wallet" }, "not-owned-workspace");
        assert.equal(savedFromDifferentWorkspace?.label, "Shared wallet");
        const savedStripe = await saveBusinessPaymentMethod(user, "stripe", {
            label: "Stripe",
            isEnabled: true,
            isTestMode: true,
            sortOrder: 0,
            instructions: "",
            supportedCurrencies: ["USD"],
            settings: {},
            credentials: { secretKey: "sk_test_owner_value", publishableKey: "pk_test_owner_value", webhookSecret: "whsec_owner_value" },
        });
        assert.equal(savedStripe?.credentials.secretKey, "sk_test_owner_value");
        const workspaceId = new mongoose.Types.ObjectId();
        await WorkspacePaymentMethodConfig.create({
            workspaceId,
            provider: "vodafone_cash",
            label: "Old workspace wallet",
            isEnabled: false,
            isTestMode: true,
            sortOrder: 0,
            instructions: "",
            supportedCurrencies: ["EGP"],
            settings: {},
        });
        const checkoutMethods = await listCheckoutPaymentMethods(undefined, String(workspaceId));
        const checkoutWallet = checkoutMethods.find(method => method.provider === "vodafone_cash");
        assert.equal(checkoutWallet?.label, "Shared wallet");
        assert.deepEqual(checkoutWallet?.supportedCurrencies, ["EGP"]);
        const checkoutStripe = checkoutMethods.find(method => method.provider === "stripe");
        assert.equal(checkoutStripe?.supportedCurrencies.includes("USD"), true);
        await PaymentMethodConfig.updateOne({ provider: "stripe" }, { $set: { "credentials.webhookSecret": "" } });
        await assert.doesNotReject(() => saveBusinessPaymentMethod(user, "stripe", {
            label: "Stripe",
            isEnabled: true,
            isTestMode: true,
            sortOrder: 0,
            instructions: "",
            supportedCurrencies: ["USD"],
            settings: {},
            credentials: { secretKey: "sk_test_owner_value", publishableKey: "pk_test_owner_value" },
        }));
        await PaymentMethodConfig.updateOne({ provider: "stripe" }, { $set: { "credentials.webhookSecret": "whsec_owner_value" } });
        await PaymentMethodConfig.updateOne({ provider: "vodafone_cash" }, { $set: { credentials: { secret: "hidden" } } });
        const methods = await listBusinessPaymentMethods(user);
        assert.equal(methods.length, 2);
        const stripe = methods.find(method => method.provider === "stripe");
        assert.equal(stripe?.credentials.secretKey, "sk_test_owner_value");
        assert.equal(stripe?.credentials.publishableKey, "pk_test_owner_value");
        assert.equal(stripe?.credentials.webhookSecret, "whsec_owner_value");
        assert.equal(JSON.stringify(checkoutMethods).includes("sk_test_owner_value"), false);
        await PaymentMethodConfig.updateOne({ provider: "stripe" }, { $set: { "credentials.webhookSecret": "" } });
        const stripeWithEmptyCredential = (await listBusinessPaymentMethods(user)).find(method => method.provider === "stripe");
        assert.notEqual(stripeWithEmptyCredential?.credentialStatus.webhookSecret, "global");
        assert.equal(stripeWithEmptyCredential?.credentials.webhookSecret, undefined);
        assert.equal(JSON.stringify(methods).includes("hidden"), false);
        await saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, isEnabled: false });
        assert.equal(await PaymentMethodConfig.countDocuments({ provider: "vodafone_cash" }), 1);
        assert.equal((await PaymentMethodConfig.findOne({ provider: "vodafone_cash" }))?.credentials.get("secret"), "hidden");
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
