import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { forbiddenError, notFoundError } from "../core/shared/errors/HttpError.js";
import Workspace from "../models/Workspace.js";

const requireWorkspaceOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = res.locals.user;
        const requested = req.query.system_slug || req.body?.system_slug || user?.workspaceId;
        if (!user?.id || typeof requested !== "string" || !requested) throw forbiddenError("Workspace owner access is required.");
        const selector = Types.ObjectId.isValid(requested)
            ? { $or: [{ _id: requested }, { slug: requested }] }
            : { slug: requested };
        const workspace = await Workspace.findOne(selector).select("ownerId").lean().exec();
        if (!workspace) throw notFoundError("Workspace not found.");
        if (String(workspace.ownerId) !== String(user.id)) throw forbiddenError("Only the workspace owner can access customer conversations and Knowledge Base data.");
        next();
    } catch (error) {
        next(error);
    }
};

export default requireWorkspaceOwner;
