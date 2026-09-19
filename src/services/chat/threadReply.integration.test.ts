import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Conversation, Message } from "../../models/index.js";
import { replyToThreadService } from "./threadManagement.js";
import { channelStrategyRegistry } from "../../core/channels/channel.registry.js";

test("thread replies validate before persistence and roll back failed delivery", { timeout: 120000 }, async () => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        await Message.init();
        const conversation = await Conversation.create({ publicId: "reply-test", sessionTokenHash: "test", systemSlug: "vizr", receivedFrom: "web", visitor: { name: "Visitor" } });
        for (const content of ["", "   ", "x".repeat(4001), undefined, { text: "invalid" }]) {
            await assert.rejects(() => replyToThreadService("reply-test", content as string), { statusCode: 422 });
        }
        await assert.rejects(() => replyToThreadService(undefined as unknown as string, "Hello"), { statusCode: 422 });
        assert.equal(await Message.countDocuments(), 0);
        const reply = await replyToThreadService(" reply-test ", " Hello ");
        assert.equal(reply.content, "Hello");
        assert.equal(reply.thread_id, "reply-test");
        await replyToThreadService("reply-test", "x".repeat(4000));
        await assert.rejects(() => replyToThreadService("missing", "Hello"), { statusCode: 404 });
        conversation.receivedFrom = "telegram";
        conversation.channelAccountId = "test-bot";
        conversation.externalContactId = "123";
        await conversation.save();
        channelStrategyRegistry.register({ channel: "telegram", async send() { throw new Error("Test delivery failed"); } });
        await assert.rejects(() => replyToThreadService("reply-test", "Undelivered"), /Test delivery failed/);
        assert.equal(await Message.countDocuments({ content: "Undelivered" }), 0);
        assert.equal(await Message.countDocuments(), 2);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
