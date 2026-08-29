import { ModelMessage } from 'ai';
import { Response } from 'express';

export interface AIGatewayOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    [key: string]: any;
}

export interface IAIService {

    stream(
        messages: ModelMessage[],
        res: Response,
        options?: AIGatewayOptions
    ): Promise<void>;


    generate(
        prompt: string | ModelMessage[],
        options?: AIGatewayOptions
    ): Promise<string>;
}