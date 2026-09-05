import type { NextFunction, Request, Response } from "express";
import { forbiddenError, unauthorizedError } from "../core/shared/errors/HttpError.js";

const requirePermission = (permission: string) => (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user) return next(unauthorizedError("Not authenticated"));
    if (!Array.isArray(user.permissions) || !user.permissions.includes(permission)) return next(forbiddenError(`Missing permission: ${permission}`));
    next();
};
export default requirePermission;
