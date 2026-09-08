import { Conversation, Message } from "../../models/index.js";
import HttpError, { createHttpError } from "../shared/errors/HttpError.js";
import { withAiReplySlot } from "./ai-reply.policy.js";
import { generateAIReply } from "../../services/aiExecution.js";
import { prepareAIConversation } from "../../services/aiContext.js";
import type { AiReplyInput, ReplyResult, ReplyStrategy } from "./reply.types.js";

export class AiReplyStrategy implements ReplyStrategy<AiReplyInput> {
    readonly type = "ai" as const;

    async reply(input: AiReplyInput): Promise<ReplyResult> {
        const replyExternalId = input.idempotencyKey ? `ai-reply:${input.idempotencyKey}` : undefined;
        if (replyExternalId) {
            const conversation = await Conversation.exists({ _id: input.conversationId, systemSlug: input.systemSlug });
            if (!conversation) throw createHttpError(404, "Conversation not found in this workspace.");
            const existing = await Message.findOne({
                conversationId: input.conversationId,
                receivedFrom: input.channel,
                externalMessageId: replyExternalId,
            }).lean().exec();
            if (existing) return { id: String(existing._id), senderType: "assistant", content: existing.content, createdAt: existing.createdAt };
        }
        const { execution, history, systemPrompt } = await prepareAIConversation(input);
        let content: string;
        try {
            content = await withAiReplySlot(() => generateAIReply(execution, history, systemPrompt));
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw createHttpError(502, "The customer-service assistant is temporarily unavailable. Retry shortly.");
        }
        const message = await Message.create({
            conversationId: input.conversationId,
            senderType: "assistant",
            receivedFrom: input.channel,
            externalMessageId: replyExternalId,
            content,
        });
        try {
            if (input.deliver) await input.deliver(content);
        } catch (error) {
            await Message.findByIdAndDelete(message._id);
            throw error;
        }
        await Conversation.findByIdAndUpdate(input.conversationId, { $set: { updatedAt: new Date() } });
        return { id: String(message._id), senderType: "assistant", content: message.content, createdAt: message.createdAt };
    }
}
