import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import AIQuotaPolicy from "../models/AIQuotaPolicy.js";
import { nextQuotaReset, reserveAIQuotas, settleAIQuotas } from "./aiQuota.js";

test("quota UTC windows handle day, month, and year boundaries", () => {
    const date = new Date("2026-12-31T23:59:45.000Z");
    assert.equal(nextQuotaReset("minute", date).toISOString(), "2027-01-01T00:00:00.000Z");
    assert.equal(nextQuotaReset("day", date).toISOString(), "2027-01-01T00:00:00.000Z");
    assert.equal(nextQuotaReset("month", date).toISOString(), "2027-01-01T00:00:00.000Z");
});

test("quota reservations against an isolated real MongoDB", { timeout: 900000 }, async context => {
    const server = await MongoMemoryServer.create({
        binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") },
    });
    try {
        await mongoose.connect(server.getUri());
        await AIQuotaPolicy.init();
        const workspaceId = new mongoose.Types.ObjectId().toString();
        const scope = { workspaceId };
        const createQuota = (values: Record<string, unknown> = {}) => AIQuotaPolicy.create({
            workspaceId,
            name: "Workspace daily",
            scope: "workspace",
            period: "day",
            requestLimit: 100,
            tokenLimit: 10000,
            concurrencyLimit: 5,
            ...values,
        });

        await context.test("simultaneous requests cannot exceed the shared concurrency limit", async () => {
            await createQuota({ concurrencyLimit: 3 });
            const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserveAIQuotas(scope, 100, 5000)));
            const admitted = results.filter(result => result.status === "fulfilled");
            assert.equal(admitted.length, 3);
            const quota = await AIQuotaPolicy.findOne(scope).lean();
            assert.equal(quota?.usedRequests, 3);
            assert.equal(quota?.usedTokens, 300);
            assert.equal(quota?.leases.length, 3);
            for (const result of admitted) {
                if (result.status === "fulfilled") await settleAIQuotas(result.value, 30);
            }
            assert.equal((await AIQuotaPolicy.findOne(scope).lean())?.usedTokens, 90);
        });

        await context.test("request and token limits use atomic predicates and settlement is idempotent", async () => {
            await AIQuotaPolicy.deleteMany({});
            await createQuota({ requestLimit: 2, tokenLimit: 150 });
            const first = await reserveAIQuotas(scope, 100, 5000);
            await assert.rejects(reserveAIQuotas(scope, 100, 5000), { statusCode: 429 });
            await settleAIQuotas(first, 20);
            await settleAIQuotas(first, 20);
            assert.equal((await AIQuotaPolicy.findOne(scope).lean())?.usedTokens, 20);
            const second = await reserveAIQuotas(scope, 100, 5000);
            await settleAIQuotas(second, 20);
            await assert.rejects(reserveAIQuotas(scope, 10, 5000), { statusCode: 429 });
        });

        await context.test("failure to reserve a later policy compensates earlier policies", async () => {
            await AIQuotaPolicy.deleteMany({});
            const first = await createQuota({ _id: new mongoose.Types.ObjectId("111111111111111111111111") });
            await createQuota({ _id: new mongoose.Types.ObjectId("222222222222222222222222"), name: "Tight budget", tokenLimit: 1 });
            await assert.rejects(reserveAIQuotas(scope, 100, 5000), { statusCode: 429 });
            const rolledBack = await AIQuotaPolicy.findById(first._id).lean();
            assert.equal(rolledBack?.usedRequests, 0);
            assert.equal(rolledBack?.usedTokens, 0);
            assert.equal(rolledBack?.leases.length, 0);
        });

        await context.test("period rollover excludes old usage but retains active concurrency", async () => {
            await AIQuotaPolicy.deleteMany({});
            const quota = await createQuota({ concurrencyLimit: 1 });
            const first = await reserveAIQuotas(scope, 100, 5000);
            await AIQuotaPolicy.updateOne({ _id: quota._id }, { $set: { resetAt: new Date(0) } });
            await assert.rejects(reserveAIQuotas(scope, 100, 5000), { statusCode: 429 });
            await settleAIQuotas(first, 20);
            const next = await reserveAIQuotas(scope, 100, 5000);
            assert.equal((await AIQuotaPolicy.findById(quota._id).lean())?.usedTokens, 100);
            await settleAIQuotas(next, 10);
        });

        await context.test("expired leases release concurrency without erasing uncertain token charges", async () => {
            await AIQuotaPolicy.deleteMany({});
            const quota = await createQuota({ concurrencyLimit: 1 });
            await reserveAIQuotas(scope, 100, 5000);
            await AIQuotaPolicy.updateOne({ _id: quota._id }, { $set: { "leases.0.expiresAt": new Date(0) } });
            const next = await reserveAIQuotas(scope, 100, 5000);
            assert.equal((await AIQuotaPolicy.findById(quota._id).lean())?.usedTokens, 200);
            await settleAIQuotas(next, 10);
            assert.equal((await AIQuotaPolicy.findById(quota._id).lean())?.usedTokens, 110);
        });

        await context.test("scoped budgets never affect a different tenant or agent", async () => {
            await AIQuotaPolicy.deleteMany({});
            const agentId = new mongoose.Types.ObjectId().toString();
            await createQuota({ scope: "agent", scopeId: agentId, tokenLimit: 1 });
            assert.deepEqual(await reserveAIQuotas(scope, 100, 5000), []);
            assert.deepEqual(await reserveAIQuotas({ workspaceId: new mongoose.Types.ObjectId().toString(), agentId }, 100, 5000), []);
            await assert.rejects(reserveAIQuotas({ ...scope, agentId }, 100, 5000), { statusCode: 429 });
        });
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
