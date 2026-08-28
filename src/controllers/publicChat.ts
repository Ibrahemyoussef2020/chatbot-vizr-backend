import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import * as service from "../services/publicChat.js";

const getSessionToken = (req: Request) => {
    const headerToken = req.get("X-Chat-Session");
    const bodyToken = req.body?.sessionToken;
    const queryToken = req.query.sessionToken;
    const token = headerToken || bodyToken || queryToken || "";

    return String(token);
};

const createConversation = async (req: Request, res: Response) => {
    const conversation = await service.createConversation(req.body);

    res.status(201).json(conversation);
};

const sendMessage = async (req: Request, res: Response) => {
    const threadId = req.body.threadId;
    const message = req.body.message;
    const attachments = req.body.attachments;
    const token = getSessionToken(req);

    const result = await service.sendMessage({
        id: threadId,
        token,
        message,
        attachments,
    });

    res.status(201).json(result);
};

const getMessages = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const token = getSessionToken(req);
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);

    const messages = await service.getMessages({
        id,
        token,
        page,
        limit,
    });

    res.status(200).json(messages);
};

const endConversation = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const token = getSessionToken(req);

    const conversation = await service.endConversation({
        id,
        token,
    });

    res.status(200).json(conversation);
};

export const create = asyncHandler(createConversation);
export const send = asyncHandler(sendMessage);
export const messages = asyncHandler(getMessages);
export const end = asyncHandler(endConversation);
