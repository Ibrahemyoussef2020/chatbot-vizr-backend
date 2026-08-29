import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { errorHandler, corsMiddleware } from "./middlewares/index.js";
import appRouter from "./routers/index.js";
import { AIFactory } from "./core/ai-gateway/ai-gateway.factory.js";
import { VercelAIProvider } from "./core/ai-gateway/providers/vercel.provider.js";
import { CustomAIProvider } from "./core/ai-gateway/providers/custom.provider.js";
import aiRouter from "./core/ai-gateway/ai.route.js";

dotenv.config();

const app = express();

app.set("etag", false);

app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

app.use(corsMiddleware);
app.options("*", corsMiddleware);

app.use(morgan("dev"));
app.use(express.json());
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



AIFactory.registerProvider('vercel', new VercelAIProvider());
AIFactory.registerProvider('custom', new CustomAIProvider());


app.use('/api/ai', aiRouter);



app.use(errorHandler);

export default app;
