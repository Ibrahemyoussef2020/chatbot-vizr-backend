import SystemLog from "../models/SystemLog.js";

export const seedSystemLogs = async () => {
    const slugs = ["brand-ecommerce", "tawasal-social-media", "ibrahem-portfolio"];

    const logs = [
        { publicId: "log-101", level: "info", category: "auth", message: "User admin@vizr.ai authenticated successfully", metadata: { ip: "127.0.0.1" } },
        { publicId: "log-102", level: "info", category: "rag", message: "Vector similarity search executed: 5 chunks retrieved", metadata: { durationMs: 45 } },
        { publicId: "log-103", level: "warn", category: "llm", message: "Primary model OpenAI rate-limited (429), switching to Gemini fallback", metadata: { provider: "Gemini" } },
        { publicId: "log-104", level: "info", category: "webhook", message: "WhatsApp inbound message webhook processed", metadata: { channel: "whatsapp" } },
        { publicId: "log-105", level: "info", category: "lead", message: "Lead captured: Sarah Ahmed (sarah@example.com)", metadata: { conversationId: "seed-thread-001" } },
    ];

    let count = 0;
    for (const slug of slugs) {
        for (const log of logs) {
            const publicId = `${log.publicId}-${slug}`;
            await SystemLog.findOneAndUpdate(
                { publicId },
                {
                    $set: {
                        systemSlug: slug,
                        level: log.level,
                        category: log.category,
                        message: log.message,
                        metadata: log.metadata,
                    },
                    $setOnInsert: {
                        publicId,
                    },
                },
                { upsert: true },
            ).exec();
            count++;
        }
    }

    return { logs: count };
};
