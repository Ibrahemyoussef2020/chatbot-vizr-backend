import assert from "node:assert/strict";
import test from "node:test";
import { channelReplyJobSchema } from "../../core/jobs/channel-reply.job.js";
import { channelReplyJobId } from "./vercel-channel-reply.queue.js";

test("channel reply job IDs are deterministic and Vercel-idempotency-safe", () => {
    const first = channelReplyJobId("whatsapp:wamid.123");
    assert.equal(first, channelReplyJobId("whatsapp:wamid.123"));
    assert.notEqual(first, channelReplyJobId("telegram:wamid.123"));
    assert.match(first, /^channel-[a-f0-9]{64}$/);
});

test("channel reply jobs require persisted message and delivery identities", () => {
    assert.equal(channelReplyJobSchema.safeParse({ channel: "whatsapp", eventId: "event" }).success, false);
    assert.equal(channelReplyJobSchema.safeParse({ channel: "instagram", eventId: "event", conversationId: "conversation", inboundMessageId: "message", systemSlug: "workspace", recipientId: "recipient" }).success, true);
});
