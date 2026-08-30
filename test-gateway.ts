import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

const apiKey = process.env.AI_GATEWAY_API_KEY;
if (!apiKey) {
    console.error("Missing AI_GATEWAY_API_KEY");
    process.exit(1);
}

// create an OpenAI provider instance 
const openai = createOpenAI({
    apiKey: apiKey,
});

async function main() {
    try {
        console.log("Sending request to AI Gateway using token:", apiKey.substring(0, 10) + "...");
        
        const result = await streamText({
            model: openai('openai/gpt-5.6-sol'),
            messages: [{ role: 'user', content: 'Say hello in Arabic!' }],
        });

        console.log("\nResponse:");
        for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
        }
        
        const usage = await result.usage;
        console.log("\n\nToken Usage:", usage);

    } catch (err: any) {
        console.error("\nError Details:");
        console.error("Message:", err.message);
        if (err.statusCode) console.error("Status:", err.statusCode);
        console.error(err);
    }
}

main();
