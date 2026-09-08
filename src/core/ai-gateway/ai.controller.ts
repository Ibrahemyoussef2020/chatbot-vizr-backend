import { Request, Response, NextFunction } from 'express';
import { runAIGateway } from '../../services/aiGateway.js';

export class AIController {
    public static async handleStream(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            await runAIGateway(res.locals.user, req.body, {
                run: async (provider, history, options) => {
                    await provider.stream(history, res, options);
                    return "";
                },
                isCommitted: () => res.headersSent,
            });
        } catch (error) {
            if (res.headersSent) {
                res.destroy();
                return;
            }
            next(error);
        }
    }

    public static async handleGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const resultText = await runAIGateway(res.locals.user, req.body);
            res.status(200).json({ success: true, text: resultText });
        } catch (error) {
            next(error);
        }
    }
}
