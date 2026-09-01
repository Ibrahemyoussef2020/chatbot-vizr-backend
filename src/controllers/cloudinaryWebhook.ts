import type { NextFunction, Request, Response } from "express";
import { forbiddenError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { verifyCloudinaryNotification, type CloudinaryAsset } from "../lib/cloudinary.js";
import { completeKnowledgeUploadFromWebhook } from "../services/knowledgeUpload.js";

export const handleCloudinaryWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
        const signature = req.get("X-Cld-Signature");
        const timestamp = req.get("X-Cld-Timestamp");
        if (!verifyCloudinaryNotification(rawBody, signature, timestamp)) throw forbiddenError("Invalid Cloudinary webhook signature.");
        let payload: CloudinaryAsset;
        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
            throw unprocessableEntityError("Invalid Cloudinary webhook payload.");
        }
        const data = await completeKnowledgeUploadFromWebhook(payload);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export default { handleCloudinaryWebhook };
