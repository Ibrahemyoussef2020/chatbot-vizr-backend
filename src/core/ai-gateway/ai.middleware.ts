import { Request, Response, NextFunction } from 'express';
import { StreamRequestSchema, GenerateRequestSchema } from './ai.lib.js';
import { ZodError } from 'zod';
import { createHttpError } from '../shared/errors/HttpError.js';

export class AIMiddleware {
    public static validateStreamPayload(req: Request, res: Response, next: NextFunction): void {
        try {
            req.body = StreamRequestSchema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                next(createHttpError(400, 'Invalid stream request payload.'));
                return;
            }
            next(error);
        }
    }

    public static validateGeneratePayload(req: Request, res: Response, next: NextFunction): void {
        try {
            req.body = GenerateRequestSchema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                next(createHttpError(400, 'Invalid generate request payload.'));
                return;
            }
            next(error);
        }
    }
}
