import type { NextFunction, Request, Response } from "express";
import {
    askKnowledgeBase,
    createKnowledgeSession,
    getKnowledgeSession,
    ingestKnowledgeFiles,
    listKnowledgeSessions,
} from "../services/knowledgeBase.js";

const parseSlug = (req: Request) => String(
    req.query.system_slug || req.body?.system_slug || "",
);

const parseId = (req: Request) => String(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
);

export const listSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await listKnowledgeSessions(res.locals.user, parseSlug(req));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const createSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await createKnowledgeSession(
            res.locals.user,
            parseSlug(req),
            req.body?.title,
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const showSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await getKnowledgeSession(
            res.locals.user,
            parseSlug(req),
            parseId(req),
        );
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const uploadSources = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const data = await ingestKnowledgeFiles(
            res.locals.user,
            parseSlug(req),
            parseId(req),
            files,
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const chat = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await askKnowledgeBase(
            res.locals.user,
            parseSlug(req),
            parseId(req),
            String(req.body?.question || ""),
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
