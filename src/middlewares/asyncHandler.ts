import { NextFunction, Request, Response } from "express";

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const asyncHandler = (controller: AsyncController) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(controller(req, res, next)).catch(next);
    };
};

export default asyncHandler;
export { asyncHandler };
