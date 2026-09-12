import { WhatsAppConfig } from "../models/index.js";

export const resolveWhatsAppPhoneConfig = async (phoneNumberId: unknown) => {
    const phoneId = String(phoneNumberId || "").trim();
    if (!phoneId) return null;
    // One physical account receives each event once; linked workspaces share its inbox.
    const configs = await WhatsAppConfig.find({ whatsapp_phone_number_id: phoneId }).sort({ createdAt: 1, _id: 1 }).limit(1).exec();
    return configs[0] || null;
};
