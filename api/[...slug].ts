import app from "../src/app.js";
import connectDB from "../src/db/index.js";

export default async function handler(req: any, res: any) {
    // Debug: log exactly what Vercel passes to this handler
    console.log("[Vercel Handler] req.url:", req.url, "req.method:", req.method);

    try {
        await connectDB();
    } catch (err) {
        console.error("[Vercel Handler] DB error:", err);
    }

    return app(req, res);
}
