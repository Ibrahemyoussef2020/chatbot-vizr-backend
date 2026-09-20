import { createHmac, timingSafeEqual } from "node:crypto";
import { MetaChannelConfig } from "../../models/index.js";
import { resolveWhatsAppPhoneConfig } from "./whatsappRouting.js";
const configuredSecrets = async (body: any): Promise<string[]> => {
    if (body?.object === "whatsapp_business_account") {
        const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
        const config = await resolveWhatsAppPhoneConfig(phoneNumberId);
        // Keep tenant credentials isolated. The shared environment secret is
        // only a fallback for this workspace when it has no App Secret saved.
        const workspaceSecret = config?.whatsapp_app_secret?.trim();
        if (workspaceSecret) return [workspaceSecret];
        return [
            process.env.WHATSAPP_APP_SECRET,
            process.env.META_APP_SECRET,
        ].map((secret) => String(secret || "").trim()).filter(Boolean);
    }
    if (body?.object === "instagram") {
        const accountId = String(body?.entry?.[0]?.id || body?.entry?.[0]?.messaging?.[0]?.recipient?.id || "");
        const config = accountId ? await MetaChannelConfig.findOne({ instagramAccountId: accountId }).select("+appSecret").exec() : null;
        return [config?.appSecret, process.env.META_APP_SECRET].map((secret) => String(secret || "").trim()).filter(Boolean);
    }
    return [process.env.META_APP_SECRET].map((secret) => String(secret || "").trim()).filter(Boolean);
};

export const verifyMetaSignature = async (body: any, rawBody: Buffer | undefined, signature?: string) => {
    if (!rawBody?.length || !signature?.startsWith("sha256=")) throw new Error("Missing Meta webhook signature.");
    const secrets = await configuredSecrets(body);
    if (!secrets.length) throw new Error("Meta webhook signature secret is not configured.");
    if (!secrets.some((secret) => isValidMetaSignature(rawBody, signature, secret))) {
        throw new Error("Invalid Meta webhook signature.");
    }
};

export const isValidMetaSignature = (rawBody: Buffer, signature: string, secret: string) => {
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};
