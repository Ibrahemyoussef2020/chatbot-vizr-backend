import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../src/app.js";
import connectDB from "../src/db/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    await connectDB();
    return app(req, res);
}
