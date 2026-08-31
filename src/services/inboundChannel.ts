import { randomUUID } from "node:crypto";
import { Conversation, Message } from "../models/index.js";
import type { ChannelName } from "../core/channels/channel.types.js";

export interface SaveInboundChannelMessageInput {
    systemSlug: string;
    receivedFrom: ChannelName;
    externalContactId: string;
    channelAccountId?: string;
    externalMessageId: string;
    content: string;
    visitor: { name: string; email?: string; phone?: string };
}

export const saveInboundChannelMessage = async (input: SaveInboundChannelMessageInput) => {
    const duplicate = await Message.findOne({
        receivedFrom: input.receivedFrom,
        externalMessageId: input.externalMessageId,
    }).exec();
    if (duplicate) return { conversation: null, message: duplicate, duplicate: true };

    const identity = {
        systemSlug: input.systemSlug,
        receivedFrom: input.receivedFrom,
        channelAccountId: input.channelAccountId || "default",
        externalContactId: input.externalContactId,
    };

    let conversation = await Conversation.findOne(identity).exec();
    const conversationCreated = !conversation;
    if (!conversation) {
        conversation = await Conversation.create({
            ...identity,
            publicId: `${input.receivedFrom}_${randomUUID()}`,
            sessionTokenHash: "external_channel",
            status: "active",
            visitor: input.visitor,
        });
    } else if (conversation.status === "ended") {
        conversation.status = "active";
        conversation.endedAt = undefined;
    }

    const message = await Message.create({
        conversationId: conversation._id,
        senderType: "visitor",
        receivedFrom: input.receivedFrom,
        externalMessageId: input.externalMessageId,
        content: input.content,
    });

    conversation.set("updatedAt", new Date());
    await conversation.save();
    return { conversation, message, duplicate: false, conversationCreated };
};
