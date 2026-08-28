import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import * as workspaceService from "../services/workspaces.js";

const index = async (req: Request, res: Response) => {
    const data = await workspaceService.listWorkspaces(res.locals.user);

    res.status(200).json({
        data,
        message: "Workspaces retrieved successfully",
    });
};

const create = async (req: Request, res: Response) => {
    const data = await workspaceService.createWorkspace(res.locals.user, req.body);

    res.status(201).json({
        data,
        message: "Workspace created successfully",
    });
};

const show = async (req: Request, res: Response) => {
    const data = await workspaceService.getWorkspace(
        res.locals.user,
        String(req.params.workspace),
    );

    res.status(200).json({
        data,
        message: "Workspace retrieved successfully",
    });
};

const update = async (req: Request, res: Response) => {
    const data = await workspaceService.updateWorkspace(
        res.locals.user,
        String(req.params.workspace),
        req.body,
    );

    res.status(200).json({
        data,
        message: "Workspace updated successfully",
    });
};

export const list = asyncHandler(index);
export const store = asyncHandler(create);
export const get = asyncHandler(show);
export const edit = asyncHandler(update);
