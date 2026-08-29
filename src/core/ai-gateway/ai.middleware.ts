import { Request, Response, NextFunction } from 'express';
import { StreamRequestSchema, GenerateRequestSchema } from './ai.lib.js';
import { ZodError } from 'zod';

export class AIMiddleware {
    public static validateStreamPayload(req: Request, res: Response, next: NextFunction): void {
        try {
            req.body = StreamRequestSchema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({ error: 'Invalid stream request payload.', details: error.issues });
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
                res.status(400).json({ error: 'Invalid generate request payload.', details: error.issues });
                return;
            }
            next(error);
        }
    }
}