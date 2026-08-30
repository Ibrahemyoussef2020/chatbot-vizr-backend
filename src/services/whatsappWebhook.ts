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
    console.log("[WhatsApp Webhook Verification Check]", { mode, token, challenge });

    if (mode === "subscribe" && (token || challenge)) {
        const expectedToken = process.env.WHATSAPP_CHANNEL_VERIFY || process.env.WHATSAPP_VERIFY_TOKEN;
        if (expectedToken && token !== expectedToken) {
            throw new Error("Invalid Webhook verification token.");
        }
        return challenge || "VERIFIED";
    }

    throw new Error("Invalid Webhook verification request.");
};

/**
 * Handles incoming Meta WhatsApp Webhook event: parses message, queries AI engine, and relays response.
 */
export const handleWhatsAppWebhookEventService = async (body: any): Promise<void> => {
    if (body?.object !== "whatsapp_business_account") return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = Array.isArray(value?.statuses) ? value.statuses : [];

    if (statuses.length) {
        const phoneNumberId = value?.metadata?.phone_number_id;
        const config = phoneNumberId
            ? await WhatsAppConfig.findOne({ whatsapp_phone_number_id: phoneNumberId }).exec()
            : null;
        const workspace = config ? await Workspace.findById(config.workspaceId).exec() : null;

        await Promise.all(statuses.map((status: any) => SystemLog.create({
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
        })));
    }

    const message = value?.messages?.[0];

    if (!message || message.type !== "text") return;

    const fromPhone = message.from;
    const textBody = message.text?.body;
    const phoneNumberId = value?.metadata?.phone_number_id;

    console.log(`[WhatsApp Inbound] Phone: ${fromPhone} | Text: "${textBody}"`);

    let config = await WhatsAppConfig.findOne({ whatsapp_phone_number_id: phoneNumberId }).exec();
    if (!config) {
        config = await WhatsAppConfig.findOne().exec();
    }

    if (!config || !config.whatsapp_access_token) return;

    const workspace = await Workspace.findById(config.workspaceId).exec();
    await SystemLog.create({
        publicId: `wa_${randomUUID()}`,
        systemSlug: workspace?.slug || "unknown",
        level: "info",
        category: "whatsapp-inbound",
        message: `WhatsApp reply received from ${fromPhone}`,
        metadata: { phone: fromPhone, text: textBody, messageId: message.id },
    });

    let aiReply = "Thank you for reaching out! Our AI assistant is currently processing your request.";

    if (config.ai_engine_type === "internal_server" && config.internal_server_url) {
        try {
            const internalRes = await fetch(`${config.internal_server_url}/chat/completions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "You are a helpful customer support AI assistant for WhatsApp." },
                        { role: "user", content: textBody },
                    ],
                }),
            });
            const internalData: any = await internalRes.json();
            if (internalData?.choices?.[0]?.message?.content) {
                aiReply = internalData.choices[0].message.content;
            }
        } catch (err: any) {
            console.error("[WhatsApp Internal AI Error]", err.message);
        }
    } else if (config.openai_api_key) {
        try {
            const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.openai_api_key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: "You are a helpful customer support AI assistant for WhatsApp." },
                        { role: "user", content: textBody },
                    ],
                }),
            });
            const aiData: any = await openAiRes.json();
            if (aiData?.choices?.[0]?.message?.content) {
                aiReply = aiData.choices[0].message.content;
            }
        } catch (err: any) {
            console.error("[WhatsApp OpenAI Error]", err.message);
        }
    }

    // Relay AI response back to user via Meta Cloud API
    const targetPhoneId = config.whatsapp_phone_number_id || phoneNumberId;
    const sendUrl = `https://graph.facebook.com/v18.0/${targetPhoneId}/messages`;

    await fetch(sendUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.whatsapp_access_token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: fromPhone,
            type: "text",
            text: { preview_url: false, body: aiReply },
        }),
    });

    console.log(`[WhatsApp Outbound AI] Replied to ${fromPhone}`);
};
