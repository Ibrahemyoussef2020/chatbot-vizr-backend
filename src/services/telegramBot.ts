import { Workspace, TelegramBot } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const listTelegramBotsService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    const filter = ws ? { workspaceId: ws._id } : {};
    let bots = await TelegramBot.find(filter).populate("workspaceId").exec();

    if (bots.length === 0 && ws) {
        const seeded = await TelegramBot.create({
            workspaceId: ws._id,
            bot_token: "7123456789:AAEF_demo_telegram_bot_token_2026",
            bot_name: `${ws.name} Telegram Bot`,
            bot_username: `${ws.slug}_support_bot`,
            ai_engine_type: "openai_api",
            internal_server_url: "http://localhost:11434/v1",
            openai_api_key: "sk-proj-demo-telegram-key",
            status: "active",
            last_activity_at: new Date(),
        });
        bots = [seeded];
    }

    return bots.map((b: any) => ({
        id: b._id.toString(),
        bot_token: b.bot_token,
        bot_name: b.bot_name,
        bot_username: b.bot_username,
        ai_engine_type: b.ai_engine_type || "openai_api",
        internal_server_url: b.internal_server_url || "http://localhost:11434/v1",
        openai_api_key: b.openai_api_key || "",
        status: b.status,
        last_activity_at: b.last_activity_at ? b.last_activity_at.toISOString() : "Never",
        error_message: b.error_message || "",
        system: {
            id: b.workspaceId?._id ? b.workspaceId._id.toString() : "",
            name: b.workspaceId?.name || "System Workspace",
            slug: b.workspaceId?.slug || "workspace",
        },
    }));
};

export const createTelegramBotService = async (payload: {
    system_id: string;
    bot_token: string;
    ai_engine_type?: "internal_server" | "openai_api";
    internal_server_url?: string;
    openai_api_key?: string;
}) => {
    let ws = await Workspace.findById(payload.system_id).exec();
    if (!ws) {
        ws = await resolveWorkspace(payload.system_id);
    }
    if (!ws) throw new Error("Target system workspace not found.");

    const tokenParts = payload.bot_token.split(":");
    const botNum = tokenParts[0] || "bot";

    const bot = await TelegramBot.create({
        workspaceId: ws._id,
        bot_token: payload.bot_token,
        bot_name: `${ws.name} Bot (${botNum})`,
        bot_username: `${ws.slug}_${botNum.slice(-4)}_bot`,
        ai_engine_type: payload.ai_engine_type || "openai_api",
        internal_server_url: payload.internal_server_url || "http://localhost:11434/v1",
        openai_api_key: payload.openai_api_key || "",
        status: "active",
        last_activity_at: new Date(),
    });

    return {
        id: bot._id.toString(),
        bot_name: bot.bot_name,
        bot_username: bot.bot_username,
        status: bot.status,
    };
};

export const refreshTelegramWebhookService = async (botId: string) => {
    const bot = await TelegramBot.findById(botId).exec();
    if (!bot) throw new Error("Bot not found.");

    bot.status = "active";
    bot.error_message = "";
    bot.last_activity_at = new Date();
    await bot.save();

    const serverUrl = process.env.SERVER_URL || "https://chatbot-vizr-backend.vercel.app";
    return {
        success: true,
        webhook_url: `${serverUrl}/api/telegram/webhook/${bot._id}`,
    };
};

export const deleteTelegramBotService = async (botId: string) => {
    await TelegramBot.findByIdAndDelete(botId).exec();
    return true;
};

export const sendTelegramTestMessageService = async (botId: string, chatId: string, text?: string) => {
    const bot = await TelegramBot.findById(botId).exec();
    if (!bot) throw new Error("Telegram bot configuration not found.");

    if (!bot.bot_token || bot.bot_token.includes("demo")) {
        throw new Error("Telegram Bot Token is using demo placeholder values. Please register a real token from @BotFather.");
    }

    const cleanChatId = chatId.trim();
    if (!cleanChatId) {
        throw new Error("Target Chat ID is required to dispatch Telegram test message.");
    }

    const messageText = text || "Hello! This is a test message from your AI ChatBot system.";
    const aiEngine = bot.ai_engine_type === "internal_server" ? `Internal Server (${bot.internal_server_url})` : "OpenAI API Key";

    const url = `https://api.telegram.org/bot${bot.bot_token}/sendMessage`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: cleanChatId,
            text: messageText,
        }),
    });

    const resData: any = await res.json().catch(() => ({}));

    if (!res.ok || !resData.ok) {
        const tgErr = resData?.description || `HTTP ${res.status}: ${res.statusText}`;
        bot.status = "error";
        bot.error_message = tgErr;
        await bot.save();
        throw new Error(`Telegram API Error: ${tgErr}`);
    }

    bot.status = "active";
    bot.error_message = "";
    bot.last_activity_at = new Date();
    await bot.save();

    return {
        sent: true,
        message_id: resData?.result?.message_id,
        chat_id: cleanChatId,
        text: messageText,
        bot_username: bot.bot_username,
        routed_via_ai_engine: aiEngine,
        timestamp: new Date().toISOString(),
    };
};
