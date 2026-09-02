import { Request, Response } from "express";
import {
    verifyWhatsAppWebhookService,
    handleWhatsAppWebhookEventService,
} from "../services/whatsappWebhook.js";
import { verifyMetaSignature } from "../services/metaWebhookSecurity.js";
import { ZodError } from "zod";

/**
 * GET /api/whatsapp/webhook - Meta Webhook Verification
 */
export const verifyWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const mode = req.query["hub.mode"] as string | undefined;
        const token = req.query["hub.verify_token"] as string | undefined;
        const challenge = req.query["hub.challenge"] as string | undefined;

        const challengeResult = await verifyWhatsAppWebhookService(mode, token, challenge);
        res.status(200).send(challengeResult);
    } catch (error: any) {
        res.status(403).json({ success: false, message: error.message || "Webhook verification failed." });
    }
};

/**
 * POST /api/whatsapp/webhook - Meta Inbound Webhook Event
 */
export const handleWhatsAppWebhookEvent = async (req: Request, res: Response): Promise<void> => {
    try {
        await verifyMetaSignature(req.body, (req as any).rawBody, req.get("X-Hub-Signature-256"));
        await handleWhatsAppWebhookEventService(req.body);
        res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
        console.error("[WhatsApp Webhook Controller Error]", error.message);
        if (/signature/i.test(error.message)) {
            res.status(403).send("FORBIDDEN");
            return;
        }
        if (error instanceof ZodError) {
            res.status(400).send("INVALID_EVENT");
            return;
        }
        // Retry valid events when persistence or queueing is temporarily unavailable.
        res.status(503).send("EVENT_RETRY");
    }
};
