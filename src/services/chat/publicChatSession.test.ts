import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createConversation, getMessages } from "./publicChat.js";

test("public chat history requires its unguessable session token", async () => {
    const server = await MongoMemoryServer.create();
    try {
        await mongoose.connect(server.getUri());
        const created = await createConversation({ name: "Visitor", systemSlug: "workspace" });
        assert.notEqual(created.sessionToken, created.thread.id);
        await assert.rejects(getMessages({ id: created.thread.id, token: "wrong-token" }), /Invalid chat session token/);
        const result = await getMessages({ id: created.thread.id, token: created.sessionToken });
        assert.equal(result.thread.id, created.thread.id);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
