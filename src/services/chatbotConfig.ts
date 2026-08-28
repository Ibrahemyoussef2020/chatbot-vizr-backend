import { Workspace } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const getChatbotConfigService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) {
        return {
            id: null,
            name: "",
            webhook_url: "",
            rate_limit: 60,
            is_active: true,
        };
    }
    return {
        id: ws._id.toString(),
        name: ws.name,
        slug: ws.slug,
        webhook_url: ws.webhookUrl || "",
        rate_limit: ws.rateLimit || 60,
        is_active: ws.isActive,
    };
};

export const updateChatbotConfigService = async (
    systemSlug?: string,
    payload?: { name?: string; webhook_url?: string; rate_limit?: number; is_active?: boolean },
) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("System workspace not found.");

    if (payload?.name !== undefined) ws.name = payload.name;
    if (payload?.webhook_url !== undefined) ws.webhookUrl = payload.webhook_url;
    if (payload?.rate_limit !== undefined) ws.rateLimit = payload.rate_limit;
    if (payload?.is_active !== undefined) ws.isActive = payload.is_active;

    await ws.save();

    return {
        id: ws._id.toString(),
        name: ws.name,
        slug: ws.slug,
        webhook_url: ws.webhookUrl || "",
        rate_limit: ws.rateLimit,
        is_active: ws.isActive,
    };
};
