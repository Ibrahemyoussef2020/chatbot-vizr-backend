import { Request, Response, NextFunction } from 'express';
import { AIFactory } from './ai-gateway.factory.js';

export class AIController {
    public static async handleStream(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { messages, provider, options } = req.body;
            const providerService = AIFactory.getProvider(provider);

            await providerService.stream(messages, res, options);
        } catch (error) {
            console.error('[AIController] Stream Handling Error:', error);
            next(error);
        }
    }

    public static async handleGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { prompt, provider, options } = req.body;
            const providerService = AIFactory.getProvider(provider);

            const resultText = await providerService.generate(prompt, options);
            res.status(200).json({ success: true, text: resultText });
        } catch (error) {
            console.error('[AIController] Generate Handling Error:', error);
            next(error);
        }
    }
}
