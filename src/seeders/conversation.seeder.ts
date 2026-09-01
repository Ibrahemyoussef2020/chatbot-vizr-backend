import { createHash } from "node:crypto";
import { Types } from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { conversationSeeds } from "./conversation.data.js";
import { seedConfig } from "./config.js";

const objectIdFor = (group: number, index: number) => {
    const groupHex = (group % 65535).toString(16).padStart(4, "0");
    const indexHex = (index + 1).toString(16).padStart(20, "0");
    return new Types.ObjectId(`${groupHex}${indexHex}`);
};

export const seedConversations = async () => {
    const sessionTokenHash = createHash("sha256")
        .update("seed-session-token-not-for-public-use")
        .digest("hex");

    for (const [conversationIndex, seed] of conversationSeeds.entries()) {
        const conversationId = objectIdFor(1, conversationIndex);
        const createdAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000);

        await Conversation.findOneAndUpdate(
            { publicId: seed.publicId },
            {
                $set: {
                    systemSlug: seed.systemSlug || seedConfig.workspaces[0].slug,
                    visitor: seed.visitor,
                    priority: seed.priority,
                    assignedAgent: seed.assignedAgent,
                    status: seed.status,
                    endedAt: seed.status === "ended" ? createdAt : undefined,
                    createdAt,
                    updatedAt: createdAt,
                },
                $setOnInsert: {
                    _id: conversationId,
                    sessionTokenHash,
                },
            },
            { upsert: true, runValidators: true },
        ).exec();

        const conversation = await Conversation.findOne({ publicId: seed.publicId }).exec();
        if (!conversation) continue;

        for (const [messageIndex, message] of seed.messages.entries()) {
            const messageId = objectIdFor(conversationIndex + 2, messageIndex);
            const messageTime = new Date(createdAt.getTime() + messageIndex * 60 * 1000);

            await Message.findByIdAndUpdate(
                messageId,
                {
                    $set: {
                        conversationId: conversation._id,
                        senderType: message.senderType,
                        content: message.content,
                        createdAt: messageTime,
                        updatedAt: messageTime,
                    },
                },
                { upsert: true, runValidators: true },
            ).exec();
        }
    }

    return { conversations: conversationSeeds.length };
};
