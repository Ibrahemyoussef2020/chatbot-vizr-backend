import TokenLog from "../models/TokenLog.js";

export const seedTokenLogs = async () => {
    const slugs = ["brand-ecommerce", "tawasal-social-media", "ibrahem-portfolio"];

    const keyConfigs = [
        { id: "key_openai_prod_01", provider: "OpenAI", model: "gpt-4o" },
        { id: "key_gemini_pro_02", provider: "Google Gemini", model: "gemini-1.5-pro" },
        { id: "key_ollama_local_03", provider: "Ollama (Local)", model: "llama3:70b" },
    ];

    const agentConfigs = [
        { sourceType: "external_api", name: "Public Chatbot Widget API" },
        { sourceType: "external_api", name: "Webhook Conversational Endpoint" },
        { sourceType: "internal_agent", name: "Lead Extraction Agent" },
        { sourceType: "internal_agent", name: "Sentiment & CSAT Classifier" },
        { sourceType: "internal_agent", name: "Knowledge Base RAG Bot" },
        { sourceType: "internal_agent", name: "Auto-Tagging Assistant" },
        { sourceType: "internal_agent", name: "Ticket Summarizer Agent" },
    ];

    let seededCount = 0;
    for (const slug of slugs) {
        // Seed 50 logs per workspace = 150 total records
        for (let i = 1; i <= 50; i++) {
            const publicId = `seed-token-run-${slug}-${i}`;
            const keyInfo = keyConfigs[i % keyConfigs.length];
            const agentInfo = agentConfigs[i % agentConfigs.length];
            const threadId = `conv-${slug}-${(i % 10) + 1}`;

            const promptTokens = Math.floor(Math.random() * 1800) + 300;
            const completionTokens = Math.floor(Math.random() * 500) + 60;
            const totalTokens = promptTokens + completionTokens;
            const durationMs = Math.floor(Math.random() * 550) + 180;
            const costUSD = keyInfo.provider === "Ollama (Local)" ? 0 : Number(((totalTokens / 1000) * 0.012).toFixed(4));
            const createdAt = new Date(Date.now() - i * 1.5 * 60 * 60 * 1000);

            await TokenLog.findOneAndUpdate(
                { publicId },
                {
                    $set: {
                        systemSlug: slug,
                        apiKeyId: keyInfo.id,
                        threadId,
                        sourceType: agentInfo.sourceType,
                        agentName: agentInfo.name,
                        model: keyInfo.model,
                        provider: keyInfo.provider,
                        promptTokens,
                        completionTokens,
                        totalTokens,
                        durationMs,
                        costUSD,
                        status: i % 8 === 0 ? "fallback" : "success",
                        createdAt,
                        updatedAt: createdAt,
                    },
                    $setOnInsert: {
                        publicId,
                    },
                },
                { upsert: true },
            ).exec();

            seededCount++;
        }
    }

    return { tokenLogs: seededCount };
};
