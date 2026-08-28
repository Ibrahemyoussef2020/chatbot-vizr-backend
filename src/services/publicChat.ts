import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { notFoundError, unauthorizedError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest();
const findConversation = async (publicId: string, token: string) => {
    const conversation = await Conversation.findOne({ publicId }).select("+sessionTokenHash").exec();
    if (!conversation) throw notFoundError("Conversation not found");
    const storedHash = Buffer.from(conversation.sessionTokenHash, "hex");
    const suppliedHash = hashToken(token);
    if (storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) throw unauthorizedError("Invalid conversation session");
    return conversation;
};

interface CreateConversationInput {
    systemSlug?: string;
    name?: string;
    email?: string;
    phone?: string;
    user_name?: string;
    user_email?: string | null;
    user_phone?: string | null;
}

export const createConversation = async (input: CreateConversationInput) => {
    const sessionToken = randomBytes(32).toString("base64url");

    const name = input.user_name ?? input.name ?? "";
    const email = input.user_email ?? input.email;
    const phone = input.user_phone ?? input.phone;

    const conversation = await Conversation.create({
        publicId: randomUUID(),
        sessionTokenHash: hashToken(sessionToken).toString("hex"),
        systemSlug: input.systemSlug?.trim() || "demo",
        visitor: {
            name: name.trim(),
            email: email?.trim().toLowerCase(),
            phone: phone?.trim(),
        },
    });

    return { thread: { id: conversation.publicId, status: conversation.status }, sessionToken };
};
export interface AttachmentInput {
    name: string;
    url: string;
    type?: string;
    size?: number;
}

export interface SendMessageInput {
    id: string;
    token: string;
    message?: string;
    attachments?: AttachmentInput[];
}

const generateAssistantReply = (content: string, name?: string): string => {
    const lower = content.toLowerCase();
    const displayName = name ? ` ${name}` : "";

    if (lower.includes("pricing") || lower.includes("cost") || lower.includes("plan")) {
        return `Hello${displayName}! Our plans start with Starter at $29/mo, Launch at $79/mo, and Scale Pro at $199/mo. You can view all features on our Pricing page.`;
    }
    if (lower.includes("channel") || lower.includes("whatsapp") || lower.includes("telegram")) {
        return `Vizr supports Web Chat Widget, WhatsApp Business, Telegram, and Meta Messenger integrations out of the box!`;
    }
    if (lower.includes("help") || lower.includes("support") || lower.includes("human")) {
        return `I'm Vizr AI Assistant! I can answer your questions grounded in your knowledge base, capture leads, or route you to a human agent.`;
    }
    return `Thanks for reaching out${displayName}! Vizr AI is active and ready to assist with your workspace setups, integrations, and automated workflows.`;
};

export const sendMessage = async (input: SendMessageInput) => {
    const content = input.message?.trim() || "";
    const attachments = input.attachments || [];

    if (!content && attachments.length === 0) {
        throw unprocessableEntityError("Message content or attachment is required");
    }

    const conversation = await findConversation(input.id, input.token);
    if (conversation.status !== "active") {
        throw unprocessableEntityError("Conversation has ended");
    }

    const visitorMessage = await Message.create({
        conversationId: conversation._id,
        senderType: "visitor",
        content: content || "Sent attachment(s)",
        attachments,
    });

    const replyText = generateAssistantReply(content, conversation.visitor?.name);
    const assistantMessage = await Message.create({
        conversationId: conversation._id,
        senderType: "assistant",
        content: replyText,
    });

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

export const getMessages = async (input: { id: string; token: string; page?: number; limit?: number }) => {
    const conversation = await findConversation(input.id, input.token);
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

export const endConversation = async (input: { id: string; token: string }) => {
    const conversation = await findConversation(input.id, input.token);
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
