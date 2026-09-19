import { WhatsAppConfig } from "../../models/index.js";

export const syncWhatsAppAccessToken = async (phoneNumberId?: string, accessToken?: string) => {
    const phoneId = (phoneNumberId || "").trim();
    const token = (accessToken || "").trim();
    if (!phoneId || !token) return;

    // Credentials belong to the physical Meta account shared by these inboxes.
    await WhatsAppConfig.updateMany(
        { whatsapp_phone_number_id: phoneId, provider: "meta" },
        { $set: { whatsapp_access_token: token } },
    ).exec();
};
