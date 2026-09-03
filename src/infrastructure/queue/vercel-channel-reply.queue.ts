import { createHash } from "node:crypto";
import { waitUntil } from "@vercel/functions";
import { send } from "@vercel/queue";
import { channelReplyJobSchema, type ChannelReplyJob, type ChannelReplyQueue } from "../../core/jobs/channel-reply.job.js";

export const CHANNEL_REPLY_TOPIC = "channel-replies";

export const channelReplyJobId = (eventId: string) => `channel-${createHash("sha256").update(eventId).digest("hex")}`;

type DirectFallback = (job: ChannelReplyJob) => Promise<void>;

export class VercelChannelReplyQueue implements ChannelReplyQueue {
    constructor(private readonly directFallback?: DirectFallback) {}

    private async publish(job: ChannelReplyJob, retry = false) {
        const parsed = channelReplyJobSchema.parse(job);
        const stableId = channelReplyJobId(`${parsed.channel}:${parsed.eventId}`);
        const idempotencyKey = retry ? `${stableId}:retry:${Date.now()}` : stableId;

        try {
            const result = await send(CHANNEL_REPLY_TOPIC, parsed, {
                idempotencyKey,
                retentionSeconds: Number(process.env.CHANNEL_QUEUE_RETENTION_SECONDS || 604_800),
            });
            return { id: result.messageId || stableId };
        } catch (error) {
            if (!this.directFallback || process.env.CHANNEL_DIRECT_FALLBACK === "false") throw error;

            // The webhook can return immediately while Vercel keeps this function alive.
            // MongoDB remains the durable source of truth if this best-effort fallback also fails.
            waitUntil(this.directFallback(parsed));
            return { id: `fallback-${stableId}` };
        }
    }

    enqueue(job: ChannelReplyJob) {
        return this.publish(job);
    }

    retry(job: ChannelReplyJob) {
        return this.publish(job, true);
    }

    async close() {}
}
