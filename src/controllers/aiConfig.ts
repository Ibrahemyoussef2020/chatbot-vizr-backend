import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { deleteAIConfigSourceService, deleteAIConfigService, getAIConfigService, listAIConfigSourcesService, saveAIConfigService, uploadAIConfigSourcesService } from "../services/aiConfig.js";

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

export const listKnowledgeSources = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await listAIConfigSourcesService(res.locals.user, parseSlug(req)) });
});

export const uploadKnowledgeSources = asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const data = await uploadAIConfigSourcesService(res.locals.user, parseSlug(req), files);
    res.status(201).json({ success: true, data });
});

export const deleteKnowledgeSource = asyncHandler(async (req: Request, res: Response) => {
    await deleteAIConfigSourceService(res.locals.user, parseSlug(req), String(req.params.id));
    res.json({ success: true });
});
