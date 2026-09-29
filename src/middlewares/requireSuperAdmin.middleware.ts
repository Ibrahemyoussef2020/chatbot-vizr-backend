import type { NextFunction, Request, Response } from "express";
import { forbiddenError, unauthorizedError } from "../core/shared/errors/HttpError.js";

const requireSuperAdmin = (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user) return next(unauthorizedError("Not authenticated"));
    if (user.role !== "super_admin") return next(forbiddenError("Super admin access is required."));
    next();
};

export default requireSuperAdmin;
