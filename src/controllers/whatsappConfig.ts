import { Request, Response } from "express";
import {
    getWhatsAppConfigService,
    saveWhatsAppConfigService,
    createOpenWASessionService,
    deleteOpenWASessionService,
    getOpenWAQRService,
    sendWhatsAppTestMessageService,
} from "../services/whatsappConfig.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getWhatsAppConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const config = await getWhatsAppConfigService(slug);
        res.json({ success: true, data: config });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch WhatsApp config." });
    }
};

export const saveWhatsAppConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const saved = await saveWhatsAppConfigService(slug, req.body);
        res.json({ success: true, data: saved, message: "WhatsApp config saved successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to save WhatsApp config." });
    }
};

export const createOpenWASession = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const sessionId = req.body?.session_id || req.body?.sessionId;
        const sessions = await createOpenWASessionService(slug, sessionId);
        res.json({ success: true, data: sessions, message: "Session created successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to create OpenWA session." });
    }
};

export const deleteOpenWASession = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
        const sessions = await deleteOpenWASessionService(slug, sessionId);
        res.json({ success: true, data: sessions, message: "Session deleted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to delete OpenWA session." });
    }
};

export const getOpenWAQR = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const qrUrl = getOpenWAQRService(slug);
        res.json({ success: true, data: { qr_code_url: qrUrl } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch OpenWA QR code." });
    }
};

export const sendWhatsAppTestMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const { phone, text } = req.body;
        const result = await sendWhatsAppTestMessageService(phone, text, slug);
        res.json({ success: true, data: result, message: "WhatsApp test message dispatched." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to send WhatsApp test message." });
    }
};
