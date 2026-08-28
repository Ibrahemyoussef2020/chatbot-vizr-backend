import { Request, Response } from "express";
import { getAIConfigService, saveAIConfigService, deleteAIConfigService } from "../services/aiConfig.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const config = await getAIConfigService(slug);
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch AI config." });
    }
};

export const saveAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const saved = await saveAIConfigService(slug, req.body);
        res.json({ success: true, data: saved, message: "AI config saved successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to save AI config." });
    }
};

export const deleteAIConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const configId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await deleteAIConfigService(configId);
        res.json({ success: true, message: "AI config deleted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to delete AI config." });
    }
};
