import type { NextFunction, Request, Response } from "express";
import { unauthorizedError } from "../core/shared/errors/HttpError.js";
import getSessionService from "../services/auth/session.js";

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await getSessionService({
            refreshToken: req.signedCookies?.jwt ?? req.cookies?.jwt,
            accessToken: req.get("X-Authorization") ?? req.get("Authorization"),
        });

        if (!session) throw unauthorizedError("Not authenticated");

        res.locals.user = {
            ...session.userInfo,
            id: String(session.userInfo.id),
            workspaceId: session.userInfo.workspaceId
                ? String(session.userInfo.workspaceId)
                : undefined,
        };
        next();
    } catch (error) {
        next(error);
    }
};

export default authenticate;
