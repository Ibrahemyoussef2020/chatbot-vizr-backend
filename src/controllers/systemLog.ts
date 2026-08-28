import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getLogs } from "../services/systemLog.js";

const index = async (req: Request, res: Response) => {
    const level = req.query.level ? String(req.query.level) : undefined;
    const systemSlug = req.query.system_slug ? String(req.query.system_slug) : undefined;

    const data = await getLogs(systemSlug, level);

    res.status(200).json({ data });
};

const download = async (req: Request, res: Response) => {
    const systemSlug = req.query.system_slug ? String(req.query.system_slug) : undefined;
    const data = await getLogs(systemSlug);

    const content = data
        .map((log) => `[${log.createdAt}] [${log.level.toUpperCase()}] [${log.category}]: ${log.message}`)
        .join("\n");

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", 'attachment; filename="system-logs.txt"');
    res.status(200).send(content);
};

export const list = asyncHandler(index);
export const exportLogs = asyncHandler(download);
