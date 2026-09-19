import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { listBusinessSubscriptions } from "../services/payments/businessSubscriptions.js";

const list = async (req: Request, res: Response) => {
    const data = await listBusinessSubscriptions(res.locals.user, req.query);
    res.status(200).json({ success: true, data });
};

export const index = asyncHandler(list);
