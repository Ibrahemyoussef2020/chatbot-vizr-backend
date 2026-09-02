import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import "../app.js";
import connectDB from "../db/index.js";
import { channelReplyJobSchema, type ChannelReplyJob } from "../core/jobs/channel-reply.job.js";
import { CHANNEL_REPLY_QUEUE } from "../infrastructure/queue/bullmq-channel-reply.queue.js";
import { createBullMQConnection } from "../infrastructure/queue/redis.js";
import { ChannelReplyJobProcessor, markChannelReplyJobFailed } from "../services/channelReplyJobProcessor.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

await connectDB();
const connection = createBullMQConnection("worker");
const processor = new ChannelReplyJobProcessor();
const worker = new Worker<ChannelReplyJob>(CHANNEL_REPLY_QUEUE, async (job) => processor.process(channelReplyJobSchema.parse(job.data)), {
    connection,
    concurrency: Number(process.env.CHANNEL_WORKER_CONCURRENCY || 10),
});

worker.on("failed", (job, error) => {
    if (!job) return;
    const attempts = Number(job.opts.attempts || 1);
    void markChannelReplyJobFailed(job.data, error, job.attemptsMade >= attempts).catch((ledgerError) => console.error("[Channel Worker] Failed to update job ledger:", ledgerError));
});
worker.on("error", (error) => console.error("[Channel Worker Error]", error));
console.log(`[Channel Worker] Listening on ${CHANNEL_REPLY_QUEUE}.`);

const shutdown = async () => {
    await worker.close();
    await connection.quit();
    process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
