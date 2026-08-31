import { randomUUID } from "node:crypto";
import { unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { generateChannelAiResponse } from "./channelAiResponse.js";

// Permanent ID lookup helper (never expires, auto-creates if missing by ID)
export const findOrCreateConversationById = async (
    publicId?: string,
    visitorData?: { name?: string; email?: string; phone?: string; systemSlug?: string }
) => {
    let conversation = null;
    const targetId = publicId?.trim();

    if (targetId) {
        conversation = await Conversation.findOne({ publicId: targetId }).exec();
    }

    const systemSlug = visitorData?.systemSlug?.trim() || "demo";
    const name = visitorData?.name?.trim() || "Guest Client";
    const email = visitorData?.email?.trim().toLowerCase();
    const phone = visitorData?.phone?.trim();

    if (!conversation && (email || phone || (name && name !== "Guest Client"))) {
        const queryConditions: any[] = [];
        if (email) queryConditions.push({ "visitor.email": email });
        if (phone) queryConditions.push({ "visitor.phone": phone });
        if (name && name !== "Guest Client") queryConditions.push({ "visitor.name": name });

        if (queryConditions.length > 0) {
            conversation = await Conversation.findOne({
                systemSlug,
                $or: queryConditions,
            }).exec();
        }
    }

    if (!conversation) {
        conversation = await Conversation.create({
            publicId: targetId || randomUUID(),
            sessionTokenHash: "permanent_no_session_needed",
            systemSlug,
            receivedFrom: "web",
            status: "active",
            visitor: {
                name,
                email,
                phone,
            },
        });
    } else {
        if (!conversation.visitor) conversation.visitor = { name };
        if (name && name !== "Guest Client") conversation.visitor.name = name;
        if (email) conversation.visitor.email = email;
        if (phone) conversation.visitor.phone = phone;
        await conversation.save();
    }

    return conversation;
};

export interface CreateConversationInput {
    systemSlug?: string;
    name?: string;
    email?: string;
    phone?: string;
    user_name?: string;
    user_email?: string | null;
    user_phone?: string | null;
}

export const createConversation = async (input: CreateConversationInput) => {
    const name = (input.user_name ?? input.name ?? "").trim();
    const email = (input.user_email ?? input.email)?.trim().toLowerCase();
    const phone = (input.user_phone ?? input.phone)?.trim();
    const systemSlug = input.systemSlug?.trim() || "demo";

    const conversation = await findOrCreateConversationById(undefined, {
        name,
        email,
        phone,
        systemSlug,
    });

    return {
        thread: { id: conversation.publicId, status: conversation.status },
        sessionToken: conversation.publicId,
    };
};

export interface AttachmentInput {
    name: string;
    url: string;
    type?: string;
    size?: number;
}

export interface SendMessageInput {
    id?: string;
    threadId?: string;
    token?: string;
    message?: string;
    attachments?: AttachmentInput[];
}

export const sendMessage = async (input: SendMessageInput) => {
    const targetId = input.id || input.threadId;
    const content = input.message?.trim() || "";
    const attachments = input.attachments || [];

    if (!content && attachments.length === 0) {
        throw unprocessableEntityError("Message content or attachment is required");
    }

    const conversation = await findOrCreateConversationById(targetId);

    const visitorMessage = await Message.create({
        conversationId: conversation._id,
        senderType: "visitor",
        receivedFrom: "web",
        content: content || "Sent attachment(s)",
        attachments,
    });

    const aiResponse = await generateChannelAiResponse({
        conversationId: String(conversation._id),
        inboundMessageId: String(visitorMessage._id),
        systemSlug: conversation.systemSlug,
        channel: "web",
    });
    const assistantMessage = aiResponse.message;

    return {
        message: {
            id: visitorMessage._id,
            senderType: visitorMessage.senderType,
            content: visitorMessage.content,
            attachments: visitorMessage.attachments,
            createdAt: visitorMessage.createdAt,
        },
        reply: {
            id: assistantMessage._id,
            senderType: assistantMessage.senderType,
            content: assistantMessage.content,
            createdAt: assistantMessage.createdAt,
        },
    };
};

export const getMessages = async (input: { id: string; token?: string; page?: number; limit?: number }) => {
    const conversation = await findOrCreateConversationById(input.id);
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(50, Math.max(1, input.limit || 25));

    const [messages, total] = await Promise.all([
        Message.find({ conversationId: conversation._id })
            .sort({ createdAt: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Message.countDocuments({ conversationId: conversation._id }),
    ]);

    return {
        messages: messages.map((message) => ({
            id: message._id,
            senderType: message.senderType,
            content: message.content,
            attachments: message.attachments || [],
            createdAt: message.createdAt,
        })),
        meta: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
        thread: {
            id: conversation.publicId,
            status: conversation.status,
        },
    };
};

export const endConversation = async (input: { id: string; token?: string }) => {
    const conversation = await findOrCreateConversationById(input.id);
    if (conversation.status !== "ended") {
        conversation.status = "ended";
        conversation.endedAt = new Date();
        await conversation.save();
    }

    return {
        thread: {
            id: conversation.publicId,
            status: conversation.status,
        },
    };
};
