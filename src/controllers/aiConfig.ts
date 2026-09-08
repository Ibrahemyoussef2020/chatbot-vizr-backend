import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getAIConfigService, saveAIConfigService, deleteAIConfigService } from "../services/aiConfig.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getAIConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await getAIConfigService(res.locals.user, parseSlug(req));
    res.json({ success: true, data: config });
});

export const saveAIConfig = asyncHandler(async (req: Request, res: Response) => {
    const saved = await saveAIConfigService(res.locals.user, parseSlug(req), req.body);
    res.json({ success: true, data: saved, message: "AI config saved successfully." });
});

export const deleteAIConfig = asyncHandler(async (req: Request, res: Response) => {
    await deleteAIConfigService(res.locals.user, String(req.params.id));
    res.json({ success: true, message: "AI config deleted successfully." });
});
