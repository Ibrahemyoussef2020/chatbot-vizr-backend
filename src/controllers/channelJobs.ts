import type { NextFunction, Request, Response } from "express";
import { listFailedChannelReplies, retryFailedChannelReply } from "../services/channelReplyJobs.js";
import { getWorkspace } from "../services/workspaces.js";

const resolveWorkspace = (req: Request, res: Response) => getWorkspace(res.locals.user, String(req.query.system_slug || req.body?.system_slug || ""));

export const failed = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await resolveWorkspace(req, res);
        res.json({ success: true, data: await listFailedChannelReplies(target.slug, Number(req.query.limit || 50)) });
    } catch (error) { next(error); }
};

export const retry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const target = await resolveWorkspace(req, res);
        res.json({ success: true, data: await retryFailedChannelReply(String(req.params.id), target.slug) });
    } catch (error) { next(error); }
};
