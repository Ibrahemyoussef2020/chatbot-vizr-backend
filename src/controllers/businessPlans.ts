import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { listBusinessPlans, saveBusinessPlan, deleteBusinessPlan } from "../services/plans/businessPlans.js";

const readPlans = async (_req: Request, res: Response) => {
    const data = await listBusinessPlans(res.locals.user);
    res.status(200).json({ success: true, data });
};

const createPlan = async (req: Request, res: Response) => {
    const data = await saveBusinessPlan(res.locals.user, req.body);
    res.status(201).json({ success: true, data });
};

const updatePlan = async (req: Request, res: Response) => {
    const data = await saveBusinessPlan(res.locals.user, req.body, String(req.params.id));
    res.status(200).json({ success: true, data });
};

const removePlan = async (req: Request, res: Response) => {
    const data = await deleteBusinessPlan(res.locals.user, String(req.params.id));
    res.status(200).json({ success: true, data });
};

export const index = asyncHandler(readPlans);
export const create = asyncHandler(createPlan);
export const update = asyncHandler(updatePlan);
export const remove = asyncHandler(removePlan);
