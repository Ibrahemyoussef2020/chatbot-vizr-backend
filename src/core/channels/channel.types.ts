export const channelNames = ["web", "whatsapp", "telegram", "gmail"] as const;

export type ChannelName = (typeof channelNames)[number];

export interface OutboundChannelMessage {
    conversationId?: string;
    recipientId: string;
    channelAccountId?: string;
    systemSlug: string;
    content: string;
}

export interface ChannelStrategy {
    readonly channel: ChannelName;
    send(message: OutboundChannelMessage): Promise<void>;
}
