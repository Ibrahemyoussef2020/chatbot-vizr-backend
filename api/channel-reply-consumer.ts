import { QueueClient } from "@vercel/queue";
import connectDB from "../src/db/index.js";
import { channelReplyJobSchema, type ChannelReplyJob } from "../src/core/jobs/channel-reply.job.js";
import { ChannelReplyJobProcessor, markChannelReplyJobFailed } from "../src/services/channelReplyJobProcessor.js";

const queue = new QueueClient();
const processor = new ChannelReplyJobProcessor();

export default queue.handleNodeCallback<ChannelReplyJob>(async (payload, metadata) => {
    await connectDB();
    const job = channelReplyJobSchema.parse(payload);
    try {
        await processor.process(job);
    } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        const maxAttempts = Number(process.env.CHANNEL_JOB_ATTEMPTS || 8);
        const terminal = metadata.deliveryCount >= maxAttempts;
        await markChannelReplyJobFailed(job, normalized, terminal);
        if (!terminal) throw normalized;
    }
}, {
    visibilityTimeoutSeconds: Number(process.env.CHANNEL_QUEUE_VISIBILITY_SECONDS || 900),
    retry: (_error, metadata) => ({
        afterSeconds: Math.min(
            Number(process.env.CHANNEL_JOB_MAX_BACKOFF_SECONDS || 300),
            2 ** Math.max(0, metadata.deliveryCount - 1) * Number(process.env.CHANNEL_JOB_BACKOFF_SECONDS || 5),
        ),
    }),
});
