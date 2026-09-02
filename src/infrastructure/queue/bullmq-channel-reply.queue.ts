import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { channelReplyJobSchema, type ChannelReplyJob, type ChannelReplyQueue } from "../../core/jobs/channel-reply.job.js";
import { createBullMQConnection } from "./redis.js";
import type { Redis } from "ioredis";

export const CHANNEL_REPLY_QUEUE = "channel-replies";
export const channelReplyJobId = (eventId: string) => `channel-${createHash("sha256").update(eventId).digest("hex")}`;

export class BullMQChannelReplyQueue implements ChannelReplyQueue {
    private connection?: Redis;
    private queue?: Queue<ChannelReplyJob>;

    private getQueue() {
        if (!this.connection) this.connection = createBullMQConnection("producer");
        if (!this.queue) this.queue = new Queue<ChannelReplyJob>(CHANNEL_REPLY_QUEUE, { connection: this.connection });
        return this.queue;
    }

    async enqueue(input: ChannelReplyJob) {
        const job = channelReplyJobSchema.parse(input);
        const id = channelReplyJobId(`${job.channel}:${job.eventId}`);
        await this.getQueue().add("reply", job, {
            jobId: id,
            attempts: Number(process.env.CHANNEL_JOB_ATTEMPTS || 5),
            backoff: { type: "exponential", delay: Number(process.env.CHANNEL_JOB_BACKOFF_MS || 2_000) },
            removeOnComplete: { age: 86_400, count: 10_000 },
            removeOnFail: false,
        });
        return { id };
    }

    async retry(input: ChannelReplyJob) {
        const job = channelReplyJobSchema.parse(input);
        const id = channelReplyJobId(`${job.channel}:${job.eventId}`);
        const existing = await this.getQueue().getJob(id);
        if (existing && await existing.isFailed()) {
            await existing.retry();
            return { id };
        }
        if (!existing) return this.enqueue(job);
        return { id };
    }

    async close() {
        await this.queue?.close();
        await this.connection?.quit();
    }
}
