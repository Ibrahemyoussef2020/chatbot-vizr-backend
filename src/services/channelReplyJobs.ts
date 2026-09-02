import { channelReplyJobSchema, channelReplyQueueRegistry, type ChannelReplyJob } from "../core/jobs/channel-reply.job.js";
import { WebhookEvent } from "../models/index.js";

export const enqueueChannelReply = async (job: ChannelReplyJob) => {
    const event = await WebhookEvent.findOneAndUpdate(
        { channel: job.channel, externalEventId: job.eventId },
        { $setOnInsert: { systemSlug: job.systemSlug, conversationId: job.conversationId, messageId: job.inboundMessageId, status: "received", payload: job } },
        { upsert: true, new: true, runValidators: true },
    ).exec();
    if (event.status === "completed") return { id: event.jobId, duplicate: true };
    const queued = await channelReplyQueueRegistry.get().enqueue(job);
    await WebhookEvent.updateOne(
        { _id: event._id, status: { $ne: "completed" } },
        { $set: { jobId: queued.id, status: "queued", lastError: "" } },
    ).exec();
    return { ...queued, duplicate: event.status !== "received" };
};

export const retryFailedChannelReply = async (eventId: string, systemSlug: string) => {
    const event = await WebhookEvent.findOne({ _id: eventId, systemSlug, status: "failed" }).exec();
    if (!event) throw new Error("Failed channel job was not found.");
    const job = event.payload as ChannelReplyJob;
    const queued = await channelReplyQueueRegistry.get().retry(channelReplyJobSchema.parse(job));
    event.status = "queued";
    event.jobId = queued.id;
    event.lastError = "";
    await event.save();
    return event;
};

export const listFailedChannelReplies = async (systemSlug: string, limit = 50) => WebhookEvent.find({ systemSlug, status: "failed" })
    .sort({ updatedAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .select("channel externalEventId jobId status attempts lastError createdAt updatedAt")
    .lean()
    .exec();
