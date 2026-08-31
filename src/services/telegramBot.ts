import { randomBytes, randomUUID } from "node:crypto";
import { Conversation, Message, Workspace, TelegramBot } from "../models/index.js";
import { saveInboundChannelMessage } from "./inboundChannel.js";
import { sendReply } from "./reply.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const listTelegramBotsService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    const filter = ws ? { workspaceId: ws._id } : {};
    const bots = await TelegramBot.find(filter).populate("workspaceId").exec();

    return bots.map((b: any) => ({
        id: b._id.toString(),
        telegram_bot_id: b.telegram_bot_id,
        bot_name: b.bot_name,
        bot_username: b.bot_username,
        welcome_message: b.welcome_message || "",
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
    welcome_message?: string;
}) => {
    let ws = await Workspace.findById(payload.system_id).exec();
    if (!ws) {
        ws = await resolveWorkspace(payload.system_id);
    }
    if (!ws) throw new Error("Target system workspace not found.");

    const token = payload.bot_token?.trim();
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token || "")) {
        throw new Error("Invalid Telegram bot token format. Copy the complete token from @BotFather.");
    }

    const identityResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const identity: any = await identityResponse.json().catch(() => ({}));
    if (!identityResponse.ok || !identity.ok || !identity.result?.id) {
        throw new Error(`Telegram token verification failed: ${identity?.description || identityResponse.statusText}`);
    }

    const telegramBotId = String(identity.result.id);
    if (await TelegramBot.exists({ telegram_bot_id: telegramBotId })) {
        throw new Error(`@${identity.result.username || telegramBotId} is already connected.`);
    }

    const bot = await TelegramBot.create({
        workspaceId: ws._id,
        bot_token: token,
        telegram_bot_id: telegramBotId,
        webhook_secret: randomBytes(24).toString("hex"),
        bot_name: identity.result.first_name || `${ws.name} Telegram Bot`,
        bot_username: identity.result.username || "",
        welcome_message: payload.welcome_message?.trim() || "Hi! Thanks for contacting us. How can we help?",
        ai_engine_type: payload.ai_engine_type || "openai_api",
        internal_server_url: payload.internal_server_url || "http://localhost:11434/v1",
        openai_api_key: payload.openai_api_key || "",
        status: "pending",
        last_activity_at: new Date(),
    });

    let webhookUrl = "";
    try {
        const webhook = await registerTelegramWebhook(bot);
        webhookUrl = webhook.webhook_url;
    } catch (error: any) {
        bot.status = "error";
        bot.error_message = error.message;
        await bot.save();
    }

    return {
        id: bot._id.toString(),
        bot_name: bot.bot_name,
        bot_username: bot.bot_username,
        status: bot.status,
        error_message: bot.error_message,
        webhook_url: webhookUrl,
    };
};

const registerTelegramWebhook = async (bot: any) => {
    const serverUrl = (process.env.SERVER_URL || "https://chatbot-vizr-backend.vercel.app").replace(/\/$/, "");
    if (!serverUrl.startsWith("https://")) throw new Error("SERVER_URL must be a public HTTPS URL for Telegram webhooks.");
    if (!bot.webhook_secret) bot.webhook_secret = randomBytes(24).toString("hex");
    const webhookUrl = `${serverUrl}/api/telegram/webhook/${bot._id}`;
    const response = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: webhookUrl,
            secret_token: bot.webhook_secret,
            allowed_updates: ["message"],
            drop_pending_updates: false,
        }),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
        throw new Error(`Telegram API Error: ${result?.description || response.statusText}`);
    }
    bot.status = "active";
    bot.error_message = "";
    bot.last_activity_at = new Date();
    await bot.save();
    return { success: true, webhook_url: webhookUrl };
};

export const refreshTelegramWebhookService = async (botId: string) => {
    const bot = await TelegramBot.findById(botId).select("+bot_token +webhook_secret").exec();
    if (!bot) throw new Error("Bot not found.");

    return registerTelegramWebhook(bot);
};

export const handleTelegramWebhookService = async (botId: string, update: any, providedSecret?: string) => {
    const bot = await TelegramBot.findById(botId).select("+bot_token +webhook_secret").populate("workspaceId").exec();
    if (!bot) throw new Error("Telegram bot configuration not found.");
    if (!bot.webhook_secret || providedSecret !== bot.webhook_secret) {
        throw new Error("Invalid Telegram webhook secret.");
    }

    const incoming = update?.message;
    const text = incoming?.text || incoming?.caption;
    if (!incoming?.message_id || !incoming?.chat?.id || !text) return;

    const workspace: any = bot.workspaceId;
    if (!workspace?.slug) throw new Error("Telegram bot workspace not found.");

    const sender = incoming.from || {};
    const name = [sender.first_name, sender.last_name].filter(Boolean).join(" ")
        || sender.username
        || `Telegram ${incoming.chat.id}`;

    const saved = await saveInboundChannelMessage({
        systemSlug: workspace.slug,
        receivedFrom: "telegram",
        externalContactId: String(incoming.chat.id),
        channelAccountId: String(bot._id),
        externalMessageId: `${bot._id}:${incoming.message_id}`,
        content: text,
        visitor: { name },
    });

    if (!saved.duplicate && saved.conversation) {
        await sendReply({
            type: "ai",
            conversationId: String(saved.conversation._id),
            inboundMessageId: String(saved.message._id),
            systemSlug: workspace.slug,
            channel: "telegram",
            deliver: async (replyText) => {
                await sendTelegramTestMessageService(
                    String(bot._id),
                    String(incoming.chat.id),
                    replyText,
                );
            },
        });
    }

    bot.status = "active";
    bot.error_message = "";
    bot.last_activity_at = new Date();
    await bot.save();
};

export const deleteTelegramBotService = async (botId: string) => {
    const bot = await TelegramBot.findById(botId).select("+bot_token").exec();
    if (!bot) return true;
    await fetch(`https://api.telegram.org/bot${bot.bot_token}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: false }),
    }).catch(() => undefined);
    await bot.deleteOne();
    return true;
};

const saveOutboundTelegramMessage = async (
    bot: any,
    chatId: string,
    content: string,
    externalMessageId?: string,
) => {
    const workspace = await Workspace.findById(bot.workspaceId).exec();
    if (!workspace) {
        throw new Error("Telegram bot workspace not found.");
    }

    const identity: Record<string, string> = {
        systemSlug: workspace.slug,
        receivedFrom: "telegram",
        channelAccountId: String(bot._id),
        externalContactId: chatId,
    };

    let conversation: any = await Conversation.findOne(identity).exec();
    if (!conversation) {
        conversation = await Conversation.create({
            ...identity,
            publicId: `telegram_${randomUUID()}`,
            sessionTokenHash: "external_channel",
            status: "active",
            visitor: {
                name: `Telegram ${chatId}`,
            },
        });
    } else if (conversation.status === "ended") {
        conversation.status = "active";
        conversation.endedAt = undefined;
    }

    const message = await Message.create({
        conversationId: conversation._id,
        senderType: "assistant",
        receivedFrom: "telegram",
        externalMessageId,
        content,
    });

    conversation.set("updatedAt", new Date());
    await conversation.save();

    return {
        conversationId: conversation.publicId,
        messageId: String(message._id),
    };
};

export const sendTelegramTestMessageService = async (
    botId: string,
    chatId: string,
    text?: string,
    persistToInbox: boolean = false,
) => {
    const bot = await TelegramBot.findById(botId).select("+bot_token").exec();
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

    const telegramMessageId = resData?.result?.message_id;
    const persisted = persistToInbox
        ? await saveOutboundTelegramMessage(
            bot,
            cleanChatId,
            messageText,
            telegramMessageId ? `${bot._id}:${telegramMessageId}` : undefined,
        )
        : undefined;

    return {
        sent: true,
        message_id: telegramMessageId,
        chat_id: cleanChatId,
        text: messageText,
        bot_username: bot.bot_username,
        routed_via_ai_engine: aiEngine,
        inbox_thread_id: persisted?.conversationId,
        inbox_message_id: persisted?.messageId,
        timestamp: new Date().toISOString(),
    };
};
