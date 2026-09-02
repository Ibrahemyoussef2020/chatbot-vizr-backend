import { randomUUID } from "node:crypto";
import { channelReplyJobSchema, type ChannelReplyJob } from "../core/jobs/channel-reply.job.js";
import { Conversation, Message, SystemLog, WebhookEvent } from "../models/index.js";
import "../core/channels/channel.strategies.js";
import { channelStrategyRegistry } from "../core/channels/channel.registry.js";
import { sendReply } from "./reply.js";

export class ChannelReplyJobProcessor {
    async process(input: ChannelReplyJob) {
        const job = channelReplyJobSchema.parse(input);
        const event = await WebhookEvent.findOne({ channel: job.channel, externalEventId: job.eventId }).exec();
        if (!event) throw new Error("Webhook event ledger entry was not found.");
        if (event.status === "completed") return { duplicate: true };
        event.status = "processing";
        event.attempts += 1;
        event.lastError = "";
        await event.save();

        const [conversation, inbound] = await Promise.all([
            Conversation.findById(job.conversationId).exec(),
            Message.findById(job.inboundMessageId).exec(),
        ]);
        if (!conversation || !inbound) throw new Error("Queued conversation or inbound message no longer exists.");

        const deliver = (content: string) => channelStrategyRegistry.send(job.channel, {
            conversationId: job.conversationId,
            recipientId: job.recipientId,
            channelAccountId: job.channelAccountId,
            systemSlug: job.systemSlug,
            content,
        });

        const reply = await sendReply({
            type: "ai",
            conversationId: job.conversationId,
            inboundMessageId: job.inboundMessageId,
            systemSlug: job.systemSlug,
            channel: job.channel,
            deliver,
            idempotencyKey: `${job.channel}:${job.eventId}`,
        });

        event.status = "completed";
        event.completedAt = new Date();
        await event.save();
        await SystemLog.create({
            publicId: `job_${randomUUID()}`,
            systemSlug: job.systemSlug,
            level: "info",
            category: "channel-job",
            message: `${job.channel} inbound message processed by the background worker.`,
            metadata: { eventId: job.eventId, replyId: reply.id, attempts: event.attempts },
        });
        return { replyId: reply.id };
    }
}

export const markChannelReplyJobFailed = async (job: ChannelReplyJob, error: Error, terminal: boolean) => {
    await WebhookEvent.updateOne(
        { channel: job.channel, externalEventId: job.eventId, status: { $ne: "completed" } },
        { $set: { status: terminal ? "failed" : "retrying", lastError: error.message.slice(0, 2000) } },
    ).exec();
    if (terminal) await SystemLog.create({
        publicId: `job_${randomUUID()}`,
        systemSlug: job.systemSlug,
        level: "error",
        category: "channel-job-failed",
        message: `${job.channel} background reply exhausted all retries.`,
        metadata: { eventId: job.eventId, error: error.message },
    });
};
