import { createHmac, timingSafeEqual } from "node:crypto";
import { MetaChannelConfig, WhatsAppConfig } from "../../models/index.js";
const configuredSecrets = async (body: any): Promise<string[]> => {
    if (body?.object === "whatsapp_business_account") {
        // A physical WhatsApp number may be linked to several workspaces. Try
        // every configured secret for the phone IDs in the event instead of
        // silently trusting whichever workspace was created first.
        const phoneIds = [...new Set((body.entry || []).flatMap((entry: any) =>
            (entry.changes || [])
                .map((change: any) => String(change?.value?.metadata?.phone_number_id || "").trim())
                .filter(Boolean),
        ))];
        const configs = phoneIds.length
            ? await WhatsAppConfig.find({ whatsapp_phone_number_id: { $in: phoneIds } } as any).select("whatsapp_app_secret").lean().exec()
            : [];
        return [
            ...configs.map((config: any) => config.whatsapp_app_secret),
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
