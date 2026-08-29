import app from "../src/app.js";
import connectDB from "../src/db/index.js";

export default async function handler(req: any, res: any) {
    if (req.url) {
        // Strip Vercel function path prefixes if present so Express routes match cleanly
        req.url = req.url.replace(/^\/api\/index(\.ts|\.js)?/, "");
        if (!req.url.startsWith("/")) {
            req.url = "/" + req.url;
        }
    }

    try {
        await connectDB();
    } catch (err) {
        console.error("[Vercel Handler] Database connection error:", err);
    }

    return app(req, res);
}
