import { Conversation, Message } from "../../models/index.js";
import { channelStrategyRegistry } from "../channels/channel.registry.js";
import type {
    AgentReplyInput,
    ReplyResult,
    ReplyStrategy,
} from "./reply.types.js";

export class AgentReplyStrategy implements ReplyStrategy<AgentReplyInput> {
    readonly type = "agent" as const;

    async reply(input: AgentReplyInput): Promise<ReplyResult> {
        const message = await Message.create({
            conversationId: input.conversationId,
            senderType: "assistant",
            receivedFrom: input.channel,
            content: input.content,
        });

        try {
            await channelStrategyRegistry.send(input.channel, {
                recipientId: input.recipientId,
                channelAccountId: input.channelAccountId,
                systemSlug: input.systemSlug,
                content: input.content,
            });
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
