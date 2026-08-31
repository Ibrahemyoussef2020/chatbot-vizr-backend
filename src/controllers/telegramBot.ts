import { Request, Response } from "express";
import {
    listTelegramBotsService,
    createTelegramBotService,
    refreshTelegramWebhookService,
    deleteTelegramBotService,
    sendTelegramTestMessageService,
    handleTelegramWebhookService,
} from "../services/telegramBot.js";

export const handleTelegramWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await handleTelegramWebhookService(botId, req.body);
        res.status(200).send("OK");
    } catch (error: any) {
        console.error("[Telegram Webhook Error]", error.message);
        res.status(200).send("OK");
    }
};

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const listTelegramBots = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const bots = await listTelegramBotsService(slug);
        res.json({ success: true, data: bots });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch Telegram bots." });
    }
};

export const createTelegramBot = async (req: Request, res: Response): Promise<void> => {
    try {
        const bot = await createTelegramBotService(req.body);
        res.json({ success: true, data: bot, message: "Telegram Bot & Webhook registered successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to register Telegram bot." });
    }
};

export const refreshTelegramWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
        const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const result = await refreshTelegramWebhookService(botId);
        res.json({ success: true, data: result, message: "Webhook re-registered successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to refresh Telegram webhook." });
    }
};

export const deleteTelegramBot = async (req: Request, res: Response): Promise<void> => {
    try {
        const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await deleteTelegramBotService(botId);
        res.json({ success: true, message: "Telegram bot deleted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to delete Telegram bot." });
    }
};

export const sendTelegramTestMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const botId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { chat_id, text } = req.body;
        const result = await sendTelegramTestMessageService(botId, chat_id, text);
        res.json({ success: true, data: result, message: "Telegram test message sent." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to send Telegram test message." });
    }
};
