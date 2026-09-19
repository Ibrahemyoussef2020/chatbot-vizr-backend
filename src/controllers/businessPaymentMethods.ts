import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { listBusinessPaymentMethods, saveBusinessPaymentMethod } from "../services/payments/businessPaymentMethods.js";

const list = async (_req: Request, res: Response) => {
    const data = await listBusinessPaymentMethods(res.locals.user);
    res.status(200).json({ success: true, data });
};

const save = async (req: Request, res: Response) => {
    const data = await saveBusinessPaymentMethod(res.locals.user, String(req.params.provider), req.body);
    res.status(200).json({ success: true, data });
};

export const index = asyncHandler(list);
export const update = asyncHandler(save);
