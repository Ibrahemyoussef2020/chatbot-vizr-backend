import { Request, Response, NextFunction } from "express";
import {
    listFilteredThreads,
    getThreadMessagesService,
    updateThreadSidebarService,
    assignThreadToAgentService,
    replyToThreadService,
    updateThreadStatusService,
} from "../services/threadManagement.js";

const parseParamId = (req: Request): string => {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
};

export const threadsList = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = res.locals.user;
        if (!user) throw new Error("Unauthorized");

        const filters = {
            systemSlug: (req.query.system_slug as string) || (req.query.workspace as string),
            status: req.query.status as string,
            assigned: req.query.assigned as string,
            channel: req.query.channel as string,
            tag: req.query.tag as string,
            priority: req.query.priority as string,
            topic: req.query.topic as string,
            days: req.query.days ? parseInt(req.query.days as string, 10) : undefined,
            search: req.query.search as string,
            sort: req.query.sort as string,
            page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 15,
        };

        const result = await listFilteredThreads(user, filters);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const threadMessages = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const threadId = parseParamId(req);
        const result = await getThreadMessagesService(threadId);
        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const updateSidebar = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const threadId = parseParamId(req);
        const updated = await updateThreadSidebarService(threadId, req.body);
        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

export const assignThread = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const threadId = req.body.threadId || req.body.thread_id;
        const agentId = req.body.agentId || req.body.agent_id;
        const agentName = req.body.agentName || req.body.agent_name;
        const agentEmail = req.body.agentEmail || req.body.agent_email;

        const updated = await assignThreadToAgentService(threadId, agentId, agentName, agentEmail);
        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

export const replyThread = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const threadId = req.body.threadId || req.body.thread_id;
        const content = req.body.content;
        const senderName = req.body.senderName || req.body.sender_name || "Support Agent";

        const message = await replyToThreadService(threadId, content, senderName);
        res.status(200).json({
            success: true,
            data: message,
        });
    } catch (error) {
        next(error);
    }
};

export const updateThread = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const threadId = parseParamId(req);
        const { status, priority } = req.body;
        const updated = await updateThreadStatusService(threadId, status, priority);
        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};
