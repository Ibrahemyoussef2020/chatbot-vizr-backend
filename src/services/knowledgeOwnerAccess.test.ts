import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import Workspace from "../models/Workspace.js";
import { createKnowledgeSession, listKnowledgeSessions } from "./knowledgeBase.js";

test("Knowledge Base services reject workspace admins who are not the owner", async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        const ownerId = new mongoose.Types.ObjectId();
        const adminId = new mongoose.Types.ObjectId();
        const workspace = await Workspace.create({ name: "Private", slug: "private", ownerId });
        const owner = { id: String(ownerId), name: "Owner", email: "owner@example.invalid", role: "admin" as const, workspaceId: String(workspace._id) };
        const admin = { id: String(adminId), name: "Admin", email: "admin@example.invalid", role: "admin" as const, workspaceId: String(workspace._id) };
        await createKnowledgeSession(owner, "private", "Owner session");
        assert.equal((await listKnowledgeSessions(owner, "private")).length, 1);
        await assert.rejects(listKnowledgeSessions(admin, "private"), /Only the workspace owner/);
        await assert.rejects(createKnowledgeSession(admin, "private", "Forbidden"), /Only the workspace owner/);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
