import { asyncHandler } from "../middlewares/asyncHandler.js";
import * as features from "../services/plans/businessFeatures.js";

export const index = asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await features.listBusinessFeatures(res.locals.user) });
});
export const options = asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await features.featureOptions(res.locals.user) });
});
export const create = asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await features.saveBusinessFeature(res.locals.user, req.body) });
});
export const update = asyncHandler(async (req, res) => {
    res.json({ success: true, data: await features.saveBusinessFeature(res.locals.user, req.body, String(req.params.id)) });
});
export const remove = asyncHandler(async (req, res) => {
    res.json({ success: true, data: await features.deleteBusinessFeature(res.locals.user, String(req.params.id)) });
});
