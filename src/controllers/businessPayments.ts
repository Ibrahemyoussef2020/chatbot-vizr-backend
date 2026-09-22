import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { decideBusinessPayment, listBusinessPayments, readBusinessPayment } from "../services/payments/businessPayments.js";

const list = async (req: Request, res: Response) => {
    const data = await listBusinessPayments(res.locals.user, req.query);
    res.status(200).json({ success: true, data });
};

const read = async (req: Request, res: Response) => {
    const data = await readBusinessPayment(res.locals.user, String(req.params.id));
    res.status(200).json({ success: true, data });
};
const decide = async (req: Request, res: Response) => {
    const data = await decideBusinessPayment(res.locals.user, String(req.params.id), req.body.decision, String(req.body.message || ""));
    res.status(200).json({ success: true, data });
};

export const index = asyncHandler(list);
export const show = asyncHandler(read);
export const decidePayment = asyncHandler(decide);
