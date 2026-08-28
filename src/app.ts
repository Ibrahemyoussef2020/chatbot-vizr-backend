import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { errorHandler } from "./middlewares/index.js";
import appRouter from "./routers/index.js";

dotenv.config();

const app = express();

app.set("etag", false);

app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
});

const configuredOrigins = (process.env.ALLOWED_URI || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin?: string) => {
    if (!origin) return true;
    if (configuredOrigins.includes(origin)) return true;
    return process.env.NODE_ENV !== "production" && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
};

app.use(
    cors({
        origin(origin, callback) {
            callback(isAllowedOrigin(origin) ? null : new Error("Origin is not allowed by CORS"), isAllowedOrigin(origin));
        },
        credentials: true,
    })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || "default_cookie_secret"));

app.use("/api", appRouter);
app.use(appRouter);

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use(errorHandler);

export default app;
