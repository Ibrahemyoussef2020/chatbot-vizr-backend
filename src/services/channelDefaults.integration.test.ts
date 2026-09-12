import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Conversation, GmailConnection, Message, TelegramBot, WhatsAppConfig, Workspace } from "../models/index.js";
import { ensureWorkspaceChannelDefaults } from "./channelDefaults.js";
import { listFilteredThreads } from "./threadManagement.js";
import { getWhatsAppConversationStatusService } from "./whatsappConfig.js";
import { processGmailMessage } from "./gmail.js";

test("workspace defaults share platform inboxes and preserve account overrides", { timeout: 120000 }, async context => {
    const server = await MongoMemoryServer.create({ binary: { downloadDir: resolve("node_modules/.cache/mongodb-memory-server") } });
    try {
        await mongoose.connect(server.getUri());
        await TelegramBot.init();
        const ownerId = new mongoose.Types.ObjectId();
        const source = await Workspace.create({ name: "Source", slug: "source", ownerId });
        const target = await Workspace.create({ name: "Target", slug: "target", ownerId });
        const custom = await Workspace.create({ name: "Custom", slug: "custom", ownerId });
        await WhatsAppConfig.create({ workspaceId: source._id, whatsapp_phone_number_id: "shared-phone", whatsapp_access_token: "source-token" });
        const bot = await TelegramBot.create({ workspaceId: source._id, telegram_bot_id: "123", bot_token: "test-token", webhook_secret: "test-secret", status: "active" });
        const gmail = await GmailConnection.create({ workspaceId: source._id, email: "shared@example.test", refreshToken: "test-refresh", status: "active" });
        await WhatsAppConfig.create({ workspaceId: custom._id, whatsapp_phone_number_id: "custom-phone", whatsapp_access_token: "custom-token" });
        await ensureWorkspaceChannelDefaults(target._id);
        await ensureWorkspaceChannelDefaults(target._id);
        await ensureWorkspaceChannelDefaults(custom._id);
        assert.equal(await TelegramBot.countDocuments({ workspaceId: target._id }), 1);
        assert.equal((await WhatsAppConfig.findOne({ workspaceId: custom._id }))?.whatsapp_phone_number_id, "custom-phone");
        assert.equal((await GmailConnection.findOne({ workspaceId: target._id }).select("+refreshToken"))?.refreshToken, "test-refresh");
        for (const [channel, account] of [["whatsapp", "shared-phone"], ["telegram", String(bot._id)], ["gmail", String(gmail._id)]] as const) {
            await Conversation.create({ publicId: channel, sessionTokenHash: "test", systemSlug: source.slug, receivedFrom: channel, channelAccountId: account, externalContactId: channel === "whatsapp" ? "201000000000" : channel, visitor: { name: "Customer" }, channelMetadata: { originatedByVizr: true } });
        }
        await Conversation.create({ publicId: "private-web", sessionTokenHash: "test", systemSlug: source.slug, receivedFrom: "web", externalContactId: "web", visitor: { name: "Private" } });
        const user = { id: String(ownerId), name: "Admin", email: "admin@example.test", role: "super_admin" as const };
        const all = await listFilteredThreads(user, { systemSlug: target.slug, channel: "all" });
        assert.deepEqual(all.threads.map(thread => thread.id).sort(), ["gmail", "telegram", "whatsapp"]);
        const whatsapp = await listFilteredThreads(user, { systemSlug: target.slug, channel: "whatsapp" });
        assert.deepEqual(whatsapp.threads.map(thread => thread.id), ["whatsapp"]);
        const customInbox = await listFilteredThreads(user, { systemSlug: custom.slug, channel: "whatsapp" });
        assert.equal(customInbox.total, 0);
        const conversation = await Conversation.findOne({ publicId: "whatsapp" });
        await Message.create({ conversationId: conversation!._id, receivedFrom: "whatsapp", senderType: "visitor", content: "Recent customer reply" });
        assert.equal((await getWhatsAppConversationStatusService("201000000000", target.slug)).replied, true);
        assert.equal((await getWhatsAppConversationStatusService("201000000000", custom.slug)).replied, false);
        const search = await listFilteredThreads(user, { systemSlug: target.slug, search: "Private" });
        assert.equal(search.total, 0);
        gmail.accessToken = "test-access";
        gmail.tokenExpiresAt = new Date(Date.now() + 3600000);
        context.mock.method(globalThis, "fetch", async () => Response.json({
            id: "new-email", threadId: "new-thread", labelIds: ["INBOX"],
            payload: { mimeType: "text/plain", headers: [{ name: "From", value: "new-customer@example.test" }], body: { data: Buffer.from("New incoming email").toString("base64url") } },
        }));
        await processGmailMessage(gmail, source, "new-email");
        for (const slug of [source.slug, target.slug, custom.slug]) {
            const inbox = await listFilteredThreads(user, { systemSlug: slug, channel: "gmail" });
            assert.equal(inbox.total, 2);
        }
        assert.equal(await Message.countDocuments({ externalMessageId: "new-email" }), 1);
        await Workspace.updateOne({ _id: target._id }, { $addToSet: { disabledChannelDefaults: "gmail" } });
        await GmailConnection.deleteOne({ workspaceId: target._id });
        await ensureWorkspaceChannelDefaults(target._id);
        assert.equal(await GmailConnection.countDocuments({ workspaceId: target._id }), 0);
    } finally {
        await mongoose.disconnect();
        await server.stop();
    }
});
