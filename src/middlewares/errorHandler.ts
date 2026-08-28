import { NextFunction, Request, Response } from "express";
import { HttpError, ValidationError } from "../core/shared/errors/index.js";

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {

    if (err instanceof ValidationError) {
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
            errors: err.errors,
        });
    }

    if (err instanceof HttpError) {
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
        });
    }

    if (err instanceof Error) {
        console.error(err);
        const status = (err as any).status || (err as any).statusCode || 500;
        return res.status(status).json({
            message: status === 500 ? "Internal server error: " + err.message : err.message,
            status: status,
        });
    }

    return res.status(500).json({
        message: "Internal server error",
        error: String(err),
        status: 500,
    });
};

export default errorHandler;