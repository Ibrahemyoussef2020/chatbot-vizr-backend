import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import PaymentMethodConfig from "../models/PaymentMethodConfig.js";
import { listBusinessPaymentMethods, saveBusinessPaymentMethod } from "./businessPaymentMethods.js";

test("method configuration uses registered providers and hides credentials", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const user = { id: String(new mongoose.Types.ObjectId()), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["payment_methods.manage"] };
        const input = { label: "Wallet", isEnabled: true, isTestMode: false, sortOrder: 1, instructions: "Send transfer", supportedCurrencies: ["EGP"], settings: { walletNumber: "01012345678", holderName: "Owner" } };
        await assert.rejects(() => saveBusinessPaymentMethod({ ...user, permissions: [] }, "vodafone_cash", input), { statusCode: 403 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "unknown", input), { statusCode: 404 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, settings: {} }));
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, settings: { ...input.settings, feePercent: 101 } }), { statusCode: 422 });
        await assert.rejects(() => saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, supportedCurrencies: ["EUR"] }), { statusCode: 422 });
        const saved = await saveBusinessPaymentMethod(user, "vodafone_cash", input);
        assert.equal(saved?.isEnabled, true);
        await PaymentMethodConfig.updateOne({ provider: "vodafone_cash" }, { $set: { credentials: { secret: "hidden" } } });
        const methods = await listBusinessPaymentMethods(user);
        assert.equal(methods.length, 2);
        assert.equal(JSON.stringify(methods).includes("hidden"), false);
        await saveBusinessPaymentMethod(user, "vodafone_cash", { ...input, isEnabled: false });
        assert.equal(await PaymentMethodConfig.countDocuments({ provider: "vodafone_cash" }), 1);
        assert.equal((await PaymentMethodConfig.findOne({ provider: "vodafone_cash" }))?.credentials.get("secret"), "hidden");
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
