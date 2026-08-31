import type { ChannelName } from "../core/channels/channel.types.js";
import { ReplyStrategyFactory } from "../core/replies/reply-strategy.factory.js";

export interface ChannelAiResponseInput {
    conversationId: string;
    inboundMessageId: string;
    systemSlug: string;
    channel: ChannelName;
    providerName?: string;
    systemPrompt?: string;
    deliver?: (content: string) => Promise<unknown>;
}

export const generateChannelAiResponse = async (
    input: ChannelAiResponseInput,
) => {
    const strategy = ReplyStrategyFactory.create("ai");
    return strategy.reply({
        type: "ai",
        ...input,
    });
};
