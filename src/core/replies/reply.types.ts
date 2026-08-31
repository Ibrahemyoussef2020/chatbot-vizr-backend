import type { ChannelName } from "../channels/channel.types.js";

export type ReplyType = "agent" | "ai";

interface BaseReplyInput {
    conversationId: string;
    systemSlug: string;
    channel: ChannelName;
}

export interface AgentReplyInput extends BaseReplyInput {
    type: "agent";
    content: string;
    recipientId: string;
    channelAccountId?: string;
    senderName?: string;
}

export interface AiReplyInput extends BaseReplyInput {
    type: "ai";
    inboundMessageId: string;
    providerName?: string;
    systemPrompt?: string;
    deliver?: (content: string) => Promise<unknown>;
}

export type ReplyInput = AgentReplyInput | AiReplyInput;

export interface ReplyResult {
    id: string;
    senderType: "assistant";
    content: string;
    createdAt: Date;
}

export interface ReplyStrategy<TInput extends ReplyInput> {
    readonly type: ReplyType;
    reply(input: TInput): Promise<ReplyResult>;
}
