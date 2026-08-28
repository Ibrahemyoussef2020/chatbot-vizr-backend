import { Request, Response, NextFunction } from "express";
import { getThreadAnalytics } from "../services/dashboardAnalytics.js";

export const analytics = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = res.locals.user;
        if (!user) throw new Error("Unauthorized");

        const requestedSlug = (req.query.system_slug as string) || (req.query.workspace as string);
        const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
        const data = await getThreadAnalytics(user, requestedSlug, days);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};
