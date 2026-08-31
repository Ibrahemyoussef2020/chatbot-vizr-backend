import type { ModelMessage } from "ai";
import { AIFactory } from "../ai-gateway/ai-gateway.factory.js";
import { Conversation, Message } from "../../models/index.js";
import type {
    AiReplyInput,
    ReplyResult,
    ReplyStrategy,
} from "./reply.types.js";

export class AiReplyStrategy implements ReplyStrategy<AiReplyInput> {
    readonly type = "ai" as const;

    private async buildHistory(input: AiReplyInput): Promise<ModelMessage[]> {
        const inboundMessage = await Message.findById(input.inboundMessageId)
            .lean()
            .exec();
        if (!inboundMessage) {
            throw new Error("Inbound message not found for AI response.");
        }

        const previousMessages = await Message.find({
            conversationId: input.conversationId,
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
    }

    async reply(input: AiReplyInput): Promise<ReplyResult> {
        const history = await this.buildHistory(input);
        const providerName = input.providerName
            || (process.env.DEFAULT_AI_PROVIDER || "vercel").trim();
        const aiService = AIFactory.getProvider(providerName);
        const content = await aiService.generate(history, {
            systemPrompt: input.systemPrompt
                || `You are Vizr AI, a helpful, friendly, and concise customer support assistant for workspace "${input.systemSlug}". Assist the user politely and answer their questions directly.`,
        });

        const message = await Message.create({
            conversationId: input.conversationId,
            senderType: "assistant",
            receivedFrom: input.channel,
            content,
        });

        try {
            if (input.deliver) {
                await input.deliver(content);
            }
        } catch (error) {
            await Message.findByIdAndDelete(message._id);
            throw error;
        }

        await Conversation.findByIdAndUpdate(input.conversationId, {
            $set: { updatedAt: new Date() },
        });

        return {
            id: String(message._id),
            senderType: "assistant",
            content: message.content,
            createdAt: message.createdAt,
        };
    }
}
