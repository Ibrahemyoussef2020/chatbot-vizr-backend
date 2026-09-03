import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { recoverStaleChannelReplies } from "../services/channelReplyJobs.js";

const authorized = (req: Request) => {
    const secret = process.env.CRON_SECRET || "";
    const supplied = req.get("authorization") || "";
    const expected = `Bearer ${secret}`;
    return secret.length >= 16
        && supplied.length === expected.length
        && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
};

export const recover = async (req: Request, res: Response) => {
    if (!authorized(req)) {
        res.status(401).json({ success: false, message: "Unauthorized recovery request." });
        return;
    }
    try {
        res.json({ success: true, data: await recoverStaleChannelReplies() });
    } catch (error) {
        console.error("[Channel Recovery Agent Error]", error);
        res.status(500).json({ success: false, message: "Recovery agent failed." });
    }
};
