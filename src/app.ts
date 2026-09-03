import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import { errorHandler, corsMiddleware } from "./middlewares/index.js";
import appRouter from "./routers/index.js";
import { AIFactory } from "./core/ai-gateway/ai-gateway.factory.js";
import { CustomAIProvider } from "./core/ai-gateway/providers/custom.provider.js";
import { UnifiedAIProvider } from "./core/ai-gateway/providers/unified.provider.js";
import { VercelGatewayAIProvider } from "./core/ai-gateway/providers/vercel-gateway.provider.js";
import { createGoogleModel, createOpenAIModel, createAnthropicModel } from "./core/ai-gateway/providers/factories.js";
import aiRouter from "./core/ai-gateway/ai.route.js";
import { handleCloudinaryWebhook } from "./controllers/cloudinaryWebhook.js";
import { KnowledgeOutputAIFactory } from "./core/knowledge/knowledge-output-ai.factory.js";
import { VercelKnowledgeOutputProvider } from "./core/knowledge/vercel-knowledge-output.provider.js";
import { channelReplyQueueRegistry } from "./core/jobs/channel-reply.job.js";
import { VercelChannelReplyQueue } from "./infrastructure/queue/vercel-channel-reply.queue.js";
import { ChannelReplyJobProcessor, markChannelReplyJobFailed } from "./services/channelReplyJobProcessor.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const app = express();

app.set("etag", false);

app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

app.use(corsMiddleware);


app.use(morgan("dev"));
app.post("/api/webhooks/cloudinary", express.raw({ type: "application/json", limit: "1mb" }), handleCloudinaryWebhook);
app.use(express.json({ verify: (req, _res, buffer) => { (req as any).rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
    delete (req as any).cookies;
    next();
});
app.use(cookieParser(process.env.COOKIE_SECRET?.trim() || "default_cookie_secret"));


app.use("/api", appRouter);
app.use(appRouter);



app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});



AIFactory.registerProvider('custom', new CustomAIProvider());
AIFactory.registerProvider('google', new UnifiedAIProvider('google', createGoogleModel));
AIFactory.registerProvider('openai', new UnifiedAIProvider('openai', createOpenAIModel));
AIFactory.registerProvider('anthropic', new UnifiedAIProvider('anthropic', createAnthropicModel));
AIFactory.registerProvider('vercel', new VercelGatewayAIProvider());
KnowledgeOutputAIFactory.registerProvider('vercel', new VercelKnowledgeOutputProvider());
channelReplyQueueRegistry.register(new VercelChannelReplyQueue(async (job) => {
    try {
        await new ChannelReplyJobProcessor().process(job);
    } catch (error) {
        await markChannelReplyJobFailed(job, error instanceof Error ? error : new Error(String(error)), false);
        throw error;
    }
}));

if (!process.env.DEFAULT_AI_PROVIDER) {
    process.env.DEFAULT_AI_PROVIDER = 'vercel';
}


app.use('/api/ai', aiRouter);



app.use(errorHandler);

export default app;
