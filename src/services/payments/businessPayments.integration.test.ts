import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import PaymentTransaction from "../../models/PaymentTransaction.js";
import { listBusinessPayments, readBusinessPayment } from "./businessPayments.js";

test("business payments filter and paginate without exposing raw events", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const user = { id: String(new mongoose.Types.ObjectId()), name: "Owner", email: "owner@test.local", role: "super_admin" as const, permissions: ["payments.view"] };
        const payment = await PaymentTransaction.create({ reference: "PAY-1", planId: new mongoose.Types.ObjectId(), planCode: "starter", provider: "stripe", amount: 29, status: "succeeded", rawEvent: { secret: "hidden" } });
        await assert.rejects(() => listBusinessPayments({ ...user, permissions: ["billing.view"] }, {}), { statusCode: 403 });
        await assert.rejects(() => readBusinessPayment({ ...user, permissions: [] }, String(payment._id)), { statusCode: 403 });
        assert.equal((await listBusinessPayments(user, { status: "succeeded", limit: 1 })).total, 1);
        assert.equal((await listBusinessPayments(user, { status: "pending" })).total, 0);
        assert.equal((await listBusinessPayments(user, { search: ".*" })).total, 0);
        assert.equal((await listBusinessPayments(user, { page: 2, limit: 1 })).items.length, 0);
        assert.equal("rawEvent" in await readBusinessPayment(user, String(payment._id)), false);
        await assert.rejects(() => listBusinessPayments(user, { limit: 1000 }), { statusCode: 422 });
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
