import { sendTelegramTestMessageService } from "../../services/telegramBot.js";
import { sendWhatsAppTestMessageService } from "../../services/whatsappConfig.js";
import { sendGmailReply } from "../../services/gmail.js";
import { channelStrategyRegistry } from "./channel.registry.js";
import type { ChannelStrategy } from "./channel.types.js";

const webStrategy: ChannelStrategy = {
    channel: "web",
    async send() {
        // Web clients read persisted replies from the messages API.
    },
};

const whatsappStrategy: ChannelStrategy = {
    channel: "whatsapp",
    async send(message) {
        await sendWhatsAppTestMessageService(message.recipientId, message.content, message.systemSlug);
    },
};

const telegramStrategy: ChannelStrategy = {
    channel: "telegram",
    async send(message) {
        if (!message.channelAccountId) throw new Error("Telegram bot ID is missing from the conversation.");
        await sendTelegramTestMessageService(message.channelAccountId, message.recipientId, message.content);
    },
};

const gmailStrategy: ChannelStrategy = {
    channel: "gmail",
    async send(message) {
        if (!message.conversationId) throw new Error("Gmail conversation ID is required.");
        await sendGmailReply(message.conversationId, message.content);
    },
};

channelStrategyRegistry.register(webStrategy);
channelStrategyRegistry.register(whatsappStrategy);
channelStrategyRegistry.register(telegramStrategy);
channelStrategyRegistry.register(gmailStrategy);
