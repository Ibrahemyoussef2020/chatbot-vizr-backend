import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app.js";
import connectDB from "../src/db/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin || "http://localhost:5173";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Authorization, X-Chat-Session");

    if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.end();
        return;
    }

    await connectDB();
    return app(req, res);
}
