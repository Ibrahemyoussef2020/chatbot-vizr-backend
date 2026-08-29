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
                { responseType: 'stream' }
            );

            response.data.on('data', (chunk: Buffer) => {
                res.write(chunk);
            });

            response.data.on('end', () => {
                res.end();
            });

            response.data.on('error', (err: Error) => {
                console.error('[CustomAIProvider] Stream read error:', err);
                res.write(`data: ${JSON.stringify({ error: 'Internal API Stream interrupted' })}\n\n`);
                res.end();
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
            });
            return response.data.text;
        } catch (error: any) {
            console.error('[CustomAIProvider] Generate request error:', error.message);
            throw error;
        }
    }
}
