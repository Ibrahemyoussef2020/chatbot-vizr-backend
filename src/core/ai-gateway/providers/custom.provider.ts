import axios from 'axios';
import { Response } from 'express';
import type { ModelMessage } from 'ai';
import { IAIService, AIGatewayOptions } from '../ai.interface.js';

export class CustomAIProvider implements IAIService {
    private customApiUrl = process.env.CUSTOM_AI_API_URL || 'http://localhost:5001/api/v1/ai';

    async stream(messages: ModelMessage[], res: Response, options?: AIGatewayOptions): Promise<void> {
        try {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const response = await axios.post(
                `${this.customApiUrl}/stream`,
                { messages, ...options },
                { responseType: 'stream', timeout: options?.timeoutMs ?? 45000 }
            );

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    response.data.destroy();
                    reject(new Error("Custom AI stream timed out."));
                }, options?.timeoutMs ?? 45000);
                const onClose = () => {
                    response.data.destroy();
                    clearTimeout(timeout);
                    reject(new Error("AI stream connection closed."));
                };
                res.once("close", onClose);
                response.data.on("data", (chunk: Buffer) => res.write(chunk));
                response.data.once("end", () => {
                    clearTimeout(timeout);
                    res.off("close", onClose);
                    res.end();
                    resolve();
                });
                response.data.once("error", (error: Error) => {
                    clearTimeout(timeout);
                    res.off("close", onClose);
                    reject(error);
                });
            });
        } catch (error: any) {
            console.error('[CustomAIProvider] Axois Connection Error:', error.message);
            throw error;
        }
    }

    async generate(prompt: string | ModelMessage[], options?: AIGatewayOptions): Promise<string> {
        try {
            const response = await axios.post(`${this.customApiUrl}/generate`, {
                prompt,
                ...options,
            }, { timeout: options?.timeoutMs ?? 45000 });
            return response.data.text;
        } catch (error: any) {
            console.error('[CustomAIProvider] Generate request error:', error.message);
            throw error;
        }
    }
}
