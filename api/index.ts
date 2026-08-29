import app from "../src/app.js";
import connectDB from "../src/db/index.js";

export default async function handler(req: any, res: any) {
    try {
        await connectDB();
    } catch (err) {
        console.error("[Vercel Handler] Database connection error:", err);
    }
    return app(req, res);
}
