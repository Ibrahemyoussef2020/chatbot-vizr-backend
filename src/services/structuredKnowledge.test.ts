import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { validateStructuredKnowledge } from "./structuredKnowledge.js";
import { getAIConfigService, saveAIConfigService } from "./aiConfig.js";
import Workspace from "../models/Workspace.js";

test("structured knowledge validates JSON types and rejects unsafe or oversized values", () => {
    const input = { products: [{ price: 0, active: false, description: "", extra: null }] };
    assert.deepEqual(validateStructuredKnowledge(input), input);
    for (const invalid of [[], null, { amount: Infinity }, { "a.b": 1 }, JSON.parse('{"__proto__":{}}'), { text: "x".repeat(50001) }]) {
        assert.throws(() => validateStructuredKnowledge(invalid));
    }
});

test("structured config round-trips in MongoDB and cannot cross workspace boundaries", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const ownerId = new mongoose.Types.ObjectId();
        const workspace = await Workspace.create({ name: "One", slug: "one", ownerId });
        await Workspace.create({ name: "Two", slug: "two", ownerId });
        const user = { id: String(ownerId), name: "Test", email: "test@example.invalid", role: "admin" as const, workspaceId: String(workspace._id) };
        const structured_knowledge = { products: [{ price: 0, available: false }], facts: { name: "Service" } };
        await saveAIConfigService(user, "one", { company_name: "Original", structured_knowledge });
        assert.deepEqual((await getAIConfigService(user, "one"))?.structured_knowledge, structured_knowledge);
        await saveAIConfigService(user, "one", { company_name: "Edited" });
        assert.deepEqual((await getAIConfigService(user, "one"))?.structured_knowledge, structured_knowledge);
        await assert.rejects(saveAIConfigService(user, "two", { structured_knowledge }));
        await assert.rejects(getAIConfigService(user, "two"));
        await assert.rejects(saveAIConfigService(user, "one", { structured_knowledge: [] }));
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
