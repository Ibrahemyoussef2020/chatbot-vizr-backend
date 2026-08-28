import { Request, Response, NextFunction } from "express";
import { getOverview } from "../services/dashboardOverview.js";

export const overview = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = res.locals.user;
        if (!user) throw new Error("Unauthorized");

        const requestedSlug = (req.query.system_slug as string) || (req.query.workspace as string);
        const data = await getOverview(user, requestedSlug);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};
