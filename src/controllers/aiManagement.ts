import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import * as service from "../services/aiManagement.js";
const slug = (req: Request) => typeof req.query.system_slug === "string" ? req.query.system_slug : undefined;
const trafficSource = (req: Request): "runtime" | "demo" | "all" => req.query.source === "runtime" ? "runtime" : req.query.source === "demo" ? "demo" : "all";
const id = (req: Request) => String(req.params.id);
const readRuntime = async (req: Request, res: Response) => {
    const data = await service.getAIRuntimeService(res.locals.user, slug(req));
    res.status(200).json({ success: true, data });
};
const writeRuntime = async (req: Request, res: Response) => {
    const data = await service.saveAIRuntimeService(res.locals.user, slug(req), req.body);
    res.status(200).json({ success: true, data });
};
export const runtime = asyncHandler(readRuntime);
export const updateRuntime = asyncHandler(writeRuntime);
export const overview = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.getAIOverviewService(res.locals.user, slug(req), trafficSource(req)) }); });
export const providers = asyncHandler(async (_req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIProvidersService() }); });
const writeProvider = async (req: Request, res: Response) => {
    const data = await service.updateAIProviderService(id(req), req.body, res.locals.user);
    res.status(200).json({ success: true, data });
};
export const updateProvider = asyncHandler(writeProvider);
export const models = asyncHandler(async (_req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIModelsService() }); });
const addModel = async (req: Request, res: Response) => {
    const data = await service.saveAIModelService(res.locals.user, req.body);
    res.status(201).json({ success: true, data });
};
const writeModel = async (req: Request, res: Response) => {
    const data = await service.saveAIModelService(res.locals.user, req.body, id(req));
    res.status(200).json({ success: true, data });
};
const removeModel = async (req: Request, res: Response) => {
    const data = await service.deleteAIModelService(id(req), res.locals.user);
    res.status(200).json({ success: true, data });
};
export const createModel = asyncHandler(addModel);
export const updateModel = asyncHandler(writeModel);
export const deleteModel = asyncHandler(removeModel);
export const agents = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIAgentsService(res.locals.user, slug(req)) }); });
export const createAgent = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ success: true, data: await service.saveAIAgentService(res.locals.user, slug(req), req.body) }); });
export const updateAgent = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.saveAIAgentService(res.locals.user, slug(req), req.body, id(req)) }); });
export const deleteAgent = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.deleteAIAgentService(res.locals.user, slug(req), id(req)) }); });
export const logs = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIRequestLogsService(res.locals.user, slug(req), trafficSource(req)) }); });
export const routing = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIRoutingService(res.locals.user, slug(req)) }); });
export const quotas = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.listAIQuotasService(res.locals.user, slug(req)) }); });
export const createRouting = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ success: true, data: await service.saveAIRoutingService(res.locals.user, slug(req), req.body) }); });
export const updateRouting = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.saveAIRoutingService(res.locals.user, slug(req), req.body, id(req)) }); });
export const deleteRouting = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.deleteAIRoutingService(res.locals.user, slug(req), id(req)) }); });
export const createQuota = asyncHandler(async (req: Request, res: Response) => { res.status(201).json({ success: true, data: await service.saveAIQuotaService(res.locals.user, slug(req), req.body) }); });
export const updateQuota = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.saveAIQuotaService(res.locals.user, slug(req), req.body, id(req)) }); });
export const deleteQuota = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.deleteAIQuotaService(res.locals.user, slug(req), id(req)) }); });
export const analytics = asyncHandler(async (req: Request, res: Response) => { res.status(200).json({ success: true, data: await service.getAIAnalyticsService(res.locals.user, slug(req), trafficSource(req)) }); });
