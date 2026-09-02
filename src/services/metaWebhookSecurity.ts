import { createHmac, timingSafeEqual } from "node:crypto";
import { MetaChannelConfig, WhatsAppConfig } from "../models/index.js";

const configuredSecret = async (body: any) => {
    if (body?.object === "whatsapp_business_account") {
        const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
        const config = phoneNumberId ? await WhatsAppConfig.findOne({ whatsapp_phone_number_id: String(phoneNumberId) }).exec() : null;
        return config?.whatsapp_app_secret?.trim() || process.env.WHATSAPP_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
    }
    if (body?.object === "instagram") {
        const accountId = String(body?.entry?.[0]?.id || body?.entry?.[0]?.messaging?.[0]?.recipient?.id || "");
        const config = accountId ? await MetaChannelConfig.findOne({ instagramAccountId: accountId }).select("+appSecret").exec() : null;
        return config?.appSecret?.trim() || process.env.META_APP_SECRET?.trim();
    }
    return process.env.META_APP_SECRET?.trim();
};

export const verifyMetaSignature = async (body: any, rawBody: Buffer | undefined, signature?: string) => {
    if (!rawBody?.length || !signature?.startsWith("sha256=")) throw new Error("Missing Meta webhook signature.");
    const secret = await configuredSecret(body);
    if (!secret) throw new Error("Meta webhook signature secret is not configured.");
    if (!isValidMetaSignature(rawBody, signature, secret)) throw new Error("Invalid Meta webhook signature.");
};

export const isValidMetaSignature = (rawBody: Buffer, signature: string, secret: string) => {
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};
