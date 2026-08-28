import { Request, Response } from "express";
import { getChatbotConfigService, updateChatbotConfigService } from "../services/chatbotConfig.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getChatbotConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const config = await getChatbotConfigService(slug);
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch chatbot config." });
    }
};

export const updateChatbotConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const updated = await updateChatbotConfigService(slug, req.body);
        res.json({ success: true, data: updated, message: "Chatbot config updated successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to update chatbot config." });
    }
};
