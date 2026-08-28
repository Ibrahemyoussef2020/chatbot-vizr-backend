import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getTokenAnalytics, getTokenLogsForApiKeyService } from "../services/tokenLog.js";

const getAnalytics = async (req: Request, res: Response) => {
    const systemSlug = req.query.system_slug ? String(req.query.system_slug) : undefined;
    const data = await getTokenAnalytics(systemSlug);

    res.status(200).json({ success: true, data });
};

const getLogsForApiKey = async (req: Request, res: Response) => {
    const apiKeyId = String(req.params.apiKeyId);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const skip = req.query.skip ? Number(req.query.skip) : 0;

    const data = await getTokenLogsForApiKeyService(apiKeyId, limit, skip);

    res.status(200).json({ success: true, data });
};

export const analytics = asyncHandler(getAnalytics);
export const apiKeyLogs = asyncHandler(getLogsForApiKey);
