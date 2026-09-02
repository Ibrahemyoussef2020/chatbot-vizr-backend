import type { Request, Response } from "express";
import { ingestInstagramWebhook, verifyInstagramWebhook } from "../services/instagram.js";
import { verifyMetaSignature } from "../services/metaWebhookSecurity.js";
import { ZodError } from "zod";

export const verify = async (req: Request, res: Response) => {
    try {
        res.status(200).send(await verifyInstagramWebhook(String(req.query["hub.mode"] || ""), String(req.query["hub.verify_token"] || ""), String(req.query["hub.challenge"] || "")));
    } catch (error: any) {
        res.status(403).json({ success: false, message: error.message });
    }
};

export const handle = async (req: Request, res: Response) => {
    try {
        await verifyMetaSignature(req.body, (req as any).rawBody, req.get("X-Hub-Signature-256"));
        await ingestInstagramWebhook(req.body);
        res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
        console.error("[Instagram Webhook Error]", error.message);
        const forbidden = /signature/i.test(error.message);
        const invalidEvent = error instanceof ZodError;
        res.status(forbidden ? 403 : invalidEvent ? 400 : 503).send(forbidden ? "FORBIDDEN" : invalidEvent ? "INVALID_EVENT" : "EVENT_RETRY");
    }
};
