import type { NextFunction, Request, Response } from "express";
import { handleStripeWebhook } from "../services/payments/stripeWebhook.js";

export const stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody?.length) throw new Error("Stripe webhook body is missing.");
        const data = await handleStripeWebhook(rawBody, req.headers);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
