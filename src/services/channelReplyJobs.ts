import { channelReplyJobSchema, channelReplyQueueRegistry, type ChannelReplyJob } from "../core/jobs/channel-reply.job.js";
import { WebhookEvent } from "../models/index.js";
import { ChannelReplyJobProcessor, markChannelReplyJobFailed } from "./channelReplyJobProcessor.js";

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

export const recoverStaleChannelReplies = async (limit = Number(process.env.CHANNEL_RECOVERY_BATCH_SIZE || 10)) => {
    const now = Date.now();
    const candidates = await WebhookEvent.find({
        $or: [
            { status: "received", updatedAt: { $lt: new Date(now - Number(process.env.CHANNEL_RECEIVED_STALE_MS || 60_000)) } },
            { status: "queued", updatedAt: { $lt: new Date(now - Number(process.env.CHANNEL_QUEUED_STALE_MS || 10 * 60_000)) } },
            { status: "retrying", updatedAt: { $lt: new Date(now - Number(process.env.CHANNEL_RETRYING_STALE_MS || 5 * 60_000)) } },
            { status: "processing", updatedAt: { $lt: new Date(now - Number(process.env.CHANNEL_PROCESSING_STALE_MS || 15 * 60_000)) } },
        ],
    }).sort({ updatedAt: 1 }).limit(Math.min(50, Math.max(1, limit))).lean().exec();

    const processor = new ChannelReplyJobProcessor();
    const results = [];
    for (const candidate of candidates) {
        const job = channelReplyJobSchema.parse(candidate.payload);
        try {
            await processor.process(job);
            results.push({ eventId: job.eventId, status: "completed" });
        } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error));
            const terminal = candidate.attempts + 1 >= Number(process.env.CHANNEL_JOB_ATTEMPTS || 8);
            await markChannelReplyJobFailed(job, normalized, terminal);
            results.push({ eventId: job.eventId, status: terminal ? "failed" : "retrying", error: normalized.message });
        }
    }
    return { scanned: candidates.length, results };
};
