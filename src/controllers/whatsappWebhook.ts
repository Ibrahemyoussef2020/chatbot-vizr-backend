import { Request, Response } from "express";
import {
    verifyWhatsAppWebhookService,
    handleWhatsAppWebhookEventService,
} from "../services/whatsappWebhook.js";

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
        // Persist the event before responding. Vercel may freeze work scheduled
        // after the response has already been sent.
        await handleWhatsAppWebhookEventService(req.body);
        res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
        console.error("[WhatsApp Webhook Controller Error]", error.message);
        // Acknowledge malformed/unhandled events so Meta does not retry forever.
        res.status(200).send("EVENT_RECEIVED");
    }
};
