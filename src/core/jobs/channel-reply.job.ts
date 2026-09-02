import { z } from "zod";

export const channelReplyJobSchema = z.object({
    eventId: z.string().min(1),
    channel: z.enum(["whatsapp", "telegram", "instagram"]),
    conversationId: z.string().min(1),
    inboundMessageId: z.string().min(1),
    systemSlug: z.string().min(1),
    recipientId: z.string().min(1),
    channelAccountId: z.string().optional(),
});

export type ChannelReplyJob = z.infer<typeof channelReplyJobSchema>;

export interface ChannelReplyQueue {
    enqueue(job: ChannelReplyJob): Promise<{ id: string }>;
    retry(job: ChannelReplyJob): Promise<{ id: string }>;
    close(): Promise<void>;
}

class ChannelReplyQueueRegistry {
    private queue?: ChannelReplyQueue;

    register(queue: ChannelReplyQueue) { this.queue = queue; }
    get(): ChannelReplyQueue {
        if (!this.queue) throw new Error("Channel reply queue is not configured.");
        return this.queue;
    }
}

export const channelReplyQueueRegistry = new ChannelReplyQueueRegistry();
