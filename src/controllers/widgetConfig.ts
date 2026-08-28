import { Request, Response } from "express";
import {
    getWidgetConfigService,
    saveWidgetConfigService,
    deleteWidgetConfigService,
    getWidgetEmbedScriptService,
} from "../services/widgetConfig.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getWidgetConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const widget = await getWidgetConfigService(slug);
        res.json({ success: true, data: widget });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch widget config." });
    }
};

export const saveWidgetConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const saved = await saveWidgetConfigService(slug, req.body);
        res.json({ success: true, data: saved, message: "Widget config saved successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to save widget config." });
    }
};

export const deleteWidgetConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        await deleteWidgetConfigService(slug);
        res.json({ success: true, message: "Widget config reset successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to delete widget config." });
    }
};

export const getWidgetEmbedScript = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const script = getWidgetEmbedScriptService(slug);
        res.json({ success: true, data: script });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to get widget embed script." });
    }
};
