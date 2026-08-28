import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getLandingPage } from "../services/landingContent.js";
//export const show = asyncHandler(async (req: Request, res: Response) => { res.status(200).json(await getLandingPage(String(req.params.slug))); });
const reciveSlug = async (req: Request, res: Response) => { 
    const stringSlug = String(req.params.slug)  ;
    const data = await getLandingPage(stringSlug);
    res.status(200).json(data);
 }
export const show = asyncHandler(reciveSlug);
