import { NextFunction, Request, Response } from "express";
import { CloudinaryError, HttpError, PaymentError, QuotaExceededError, ValidationError } from "../core/shared/errors/index.js";

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[ERROR HANDLER CAUGHT]:", err);

    // Do not expose Mongo/Mongoose connection and buffering details to users.
    // Keep the original error in server logs and present a retryable response.
    if (err instanceof Error && /buffering timed out|server selection timed out|MongoServerSelectionError/i.test(err.message)) {
        return res.status(503).json({
            message: "The service is temporarily unavailable. Please try again shortly.",
            status: 503,
            retryable: true,
        });
    }

    if (err instanceof ValidationError) {
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
            errors: err.errors,
        });
    }

    if (err instanceof CloudinaryError) {
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
            code: err.code,
            retryable: err.retryable,
        });
    }

    if (err instanceof QuotaExceededError) {
        res.setHeader("Retry-After", String(err.retryAfterSeconds));
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
            metric: err.metric,
            limit: err.limit,
            used: err.used,
            window: err.window,
            retryAfterSeconds: err.retryAfterSeconds,
        });
    }

    if (err instanceof PaymentError) {
        return res.status(err.status).json({
            message: err.message,
            status: err.status,
            code: err.code,
            provider: err.provider,
            retryable: err.retryable,
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
