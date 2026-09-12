import assert from "node:assert/strict";
import test from "node:test";
import { Conversation, Message, SystemLog, WebhookEvent, WhatsAppConfig, Workspace } from "../models/index.js";
import { handleWhatsAppWebhookEventService } from "./whatsappWebhook.js";

const query = (value: unknown) => ({ exec: async () => value });
const value = (ids: string[]) => ({
    metadata: { phone_number_id: "phone-account" },
    messages: ids.map(id => ({ id, from: "test-sender", type: "text", text: { body: "Test message" } })),
});

test("WhatsApp processes every message across entries and changes, including retries", async context => {
    context.mock.method(WhatsAppConfig, "findOne", () => query({ workspaceId: "workspace-id" }));
    context.mock.method(Workspace, "findById", () => query({ slug: "workspace" }));
    context.mock.method(SystemLog, "exists", () => Promise.resolve(false));
    context.mock.method(SystemLog, "create", () => Promise.resolve({}));
    const received: string[] = [];
    context.mock.method(Message, "findOne", (filter: any) => {
        assert.equal(filter.receivedFrom, "whatsapp");
        received.push(filter.externalMessageId);
        return query({ _id: filter.externalMessageId, conversationId: "conversation-id" });
    });
    context.mock.method(Conversation, "findById", () => query({ _id: "conversation-id" }));
    context.mock.method(WebhookEvent, "findOneAndUpdate", () => query({ status: "completed" }));
    await handleWhatsAppWebhookEventService({
        object: "whatsapp_business_account",
        entry: [
            { changes: [{ value: value(["one", "two"]) }, { value: value(["three"]) }] },
            { changes: [{ value: value(["four"]) }] },
        ],
    });
    assert.deepEqual(received, ["one", "two", "three", "four"]);
});

test("unmapped WhatsApp messages fail instead of being silently acknowledged", async context => {
    context.mock.method(WhatsAppConfig, "findOne", () => query(null));
    await assert.rejects(handleWhatsAppWebhookEventService({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ value: value(["unmapped"]) }] }],
    }), /not mapped to a workspace/);
});
