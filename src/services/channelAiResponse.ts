import type { ModelMessage } from "ai";
import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";
import type { ChannelName } from "../core/channels/channel.types.js";
import { Conversation, Message } from "../models/index.js";

export interface ChannelAiResponseInput {
    conversationId: string;
    inboundMessageId: string;
    systemSlug: string;
    channel: ChannelName;
    providerName?: string;
    systemPrompt?: string;
    deliver?: (content: string) => Promise<unknown>;
}

const buildConversationHistory = async (
    conversationId: string,
    inboundMessageId: string,
): Promise<ModelMessage[]> => {
    const inboundMessage = await Message.findById(inboundMessageId).lean().exec();
    if (!inboundMessage) {
        throw new Error("Inbound message not found for AI response.");
    }

    const previousMessages = await Message.find({
        conversationId,
        _id: { $ne: inboundMessage._id },
    })
        .sort({ createdAt: -1 })
        .limit(9)
        .lean()
        .exec();

    const history: ModelMessage[] = previousMessages.reverse().map((message) => ({
        role: message.senderType === "visitor" ? "user" : "assistant",
        content: message.content,
    }));

    history.push({
        role: "user",
        content: inboundMessage.content,
    });

    return history;
};

export const generateChannelAiResponse = async (
    input: ChannelAiResponseInput,
) => {
    const history = await buildConversationHistory(
        input.conversationId,
        input.inboundMessageId,
    );
    const providerName = input.providerName
        || (process.env.DEFAULT_AI_PROVIDER || "vercel").trim();
    const aiService = AIFactory.getProvider(providerName);
    const replyText = await aiService.generate(history, {
        systemPrompt: input.systemPrompt
            || `You are Vizr AI, a helpful, friendly, and concise customer support assistant for workspace "${input.systemSlug}". Assist the user politely and answer their questions directly.`,
    });

    const assistantMessage = await Message.create({
        conversationId: input.conversationId,
        senderType: "assistant",
        receivedFrom: input.channel,
        content: replyText,
    });

    try {
        if (input.deliver) {
            await input.deliver(replyText);
        }
    } catch (error) {
        await Message.findByIdAndDelete(assistantMessage._id);
        throw error;
    }

    await Conversation.findByIdAndUpdate(input.conversationId, {
        $set: { updatedAt: new Date() },
    });

    return {
        message: assistantMessage,
        content: replyText,
    };
};
