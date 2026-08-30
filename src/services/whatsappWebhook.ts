import { randomUUID } from "node:crypto";
import { SystemLog, WhatsAppConfig, Workspace } from "../models/index.js";

/**
 * Verifies Meta Webhook challenge token against stored workspace config.
 */
export const verifyWhatsAppWebhookService = async (
    mode?: string,
    token?: string,
    challenge?: string
): Promise<string> => {
    if (mode === "subscribe" && token && challenge) {
        const environmentToken = (process.env.WHATSAPP_CHANNEL_VERIFY || process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
        const matchesEnvironment = Boolean(environmentToken && token === environmentToken);
        const matchesWorkspace = Boolean(await WhatsAppConfig.exists({ whatsapp_verify_token: token.trim() }));

        if (matchesEnvironment || matchesWorkspace) return challenge;
        throw new Error("Invalid Webhook verification token.");
    }

    throw new Error("Invalid Webhook verification request.");
};

/**
 * Persists Meta delivery and inbound-message events. Keep this request path
 * fast and deterministic so serverless runtimes can acknowledge Meta reliably.
 */
export const handleWhatsAppWebhookEventService = async (body: any): Promise<void> => {
    if (body?.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = Array.isArray(value?.statuses) ? value.statuses : [];

    if (statuses.length) {
        console.log("[WhatsApp Delivery Status]", JSON.stringify(statuses.map((status: any) => ({
            id: status.id,
            recipient: status.recipient_id,
            status: status.status,
            errors: status.errors || [],
        }))));
        const phoneNumberId = value?.metadata?.phone_number_id;
        const config = phoneNumberId
            ? await WhatsAppConfig.findOne({ whatsapp_phone_number_id: phoneNumberId }).exec()
            : null;
        const workspace = config ? await Workspace.findById(config.workspaceId).exec() : null;

        await Promise.all(statuses.map(async (status: any) => {
            const exists = await SystemLog.exists({ category: "whatsapp-delivery", "metadata.messageId": status.id, "metadata.status": status.status });
            if (exists) return;
            await SystemLog.create({
            publicId: `wa_${randomUUID()}`,
            systemSlug: workspace?.slug || "unknown",
            level: status.status === "failed" ? "error" : "info",
            category: "whatsapp-delivery",
            message: `WhatsApp message ${status.status || "status updated"}`,
            metadata: {
                messageId: status.id,
                recipient: status.recipient_id,
                status: status.status,
                timestamp: status.timestamp,
                errors: status.errors || [],
            },
            });
        }));
    }

    const message = value?.messages?.[0];

    if (!message) return;

    const fromPhone = message.from;
    const textBody = message.text?.body
        || message.button?.text
        || message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || `[${message.type || "unsupported"} message]`;
    const phoneNumberId = value?.metadata?.phone_number_id;

    console.log(`[WhatsApp Inbound] Phone: ${fromPhone} | Text: "${textBody}"`);

    const config = phoneNumberId
        ? await WhatsAppConfig.findOne({ whatsapp_phone_number_id: String(phoneNumberId).trim() }).exec()
        : null;
    if (!config) return;

    const workspace = await Workspace.findById(config.workspaceId).exec();
    const alreadyRecorded = await SystemLog.exists({ category: "whatsapp-inbound", "metadata.messageId": message.id });
    if (alreadyRecorded) return;
    await SystemLog.create({
        publicId: `wa_${randomUUID()}`,
        systemSlug: workspace?.slug || "unknown",
        level: "info",
        category: "whatsapp-inbound",
        message: `WhatsApp reply received from ${fromPhone}`,
        metadata: { phone: fromPhone, text: textBody, messageId: message.id, type: message.type },
    });
};
