import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import * as service from "../services/tag.js";

const list = async (req: Request, res: Response) => {
    const systemSlug = req.query.system_slug ? String(req.query.system_slug) : undefined;
    const data = await service.listTags(systemSlug);

    res.status(200).json({ data });
};

const store = async (req: Request, res: Response) => {
    const data = await service.createTag({
        systemSlug: req.body.systemSlug || req.body.system_slug,
        label: req.body.label || req.body.name,
        name: req.body.name || req.body.label,
        bg: req.body.bg,
        color: req.body.color,
        description: req.body.description,
    });

    res.status(201).json({ data });
};

const update = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = await service.updateTag(id, {
        label: req.body.label || req.body.name,
        name: req.body.name || req.body.label,
        bg: req.body.bg,
        color: req.body.color,
        description: req.body.description,
    });

    res.status(200).json({ data });
};

const destroy = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = await service.deleteTag(id);

    res.status(200).json(data);
};

export const index = asyncHandler(list);
export const create = asyncHandler(store);
export const edit = asyncHandler(update);
export const remove = asyncHandler(destroy);
