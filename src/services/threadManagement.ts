import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import { forbiddenError, notFoundError } from "../core/shared/errors/HttpError.js";
import type { AuthenticatedUserContext } from "./workspaces.js";

const resolveWorkspaceSlug = async (
    user: AuthenticatedUserContext,
    requestedSlug?: string,
) => {
    if (!requestedSlug || requestedSlug === "all") {
        return undefined;
    }

    if (user.role === "super_admin") {
        const workspace = await Workspace.findOne({ slug: requestedSlug }).lean().exec();
        if (!workspace) throw notFoundError("Workspace not found");

        return workspace.slug;
    }

    if (!user.workspaceId) throw forbiddenError("No workspace is assigned to this account");

    const workspace = await Workspace.findById(user.workspaceId).lean().exec();
    if (!workspace) throw notFoundError("Workspace not found");
    if (requestedSlug && requestedSlug !== workspace.slug) {
        throw forbiddenError("You do not have access to this workspace");
    }

    return workspace.slug;
};

export interface ThreadFilterInput {
    systemSlug?: string;
    status?: string;
    assigned?: string;
    channel?: string;
    tag?: string;
    priority?: string;
    topic?: string;
    days?: number;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
}

export const listFilteredThreads = async (
    user: AuthenticatedUserContext,
    input: ThreadFilterInput,
) => {
    const systemSlug = await resolveWorkspaceSlug(user, input.systemSlug);
    const query: Record<string, unknown> = {};

    if (systemSlug) query.systemSlug = systemSlug;

    if (input.status && input.status !== "all") {
        if (input.status === "open" || input.status === "active") query.status = "active";
        else if (input.status === "closed" || input.status === "ended") query.status = "ended";
    }

    if (input.priority && input.priority !== "all") {
        query.priority = input.priority.toLowerCase();
    }

    if (input.days && input.days > 0) {
        const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: startDate };
    }

    if (input.search && input.search.trim()) {
        const searchRegex = new RegExp(input.search.trim(), "i");
        query.$or = [
            { publicId: searchRegex },
            { "visitor.name": searchRegex },
            { "visitor.email": searchRegex },
            { "visitor.phone": searchRegex },
        ];
    }

    const page = Math.max(input.page || 1, 1);
    const limit = Math.max(input.limit || 15, 1);
    const skip = (page - 1) * limit;

    let sortOption: Record<string, 1 | -1> = { updatedAt: -1 };
    if (input.sort === "oldest") sortOption = { createdAt: 1 };
    else if (input.sort === "newest") sortOption = { createdAt: -1 };

    const [total, conversations] = await Promise.all([
        Conversation.countDocuments(query),
        Conversation.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
    ]);

    return {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        threads: conversations.map((c) => ({
            id: c.publicId,
            user_name: c.visitor?.name || "Guest User",
            user_email: c.visitor?.email,
            user_phone: c.visitor?.phone,
            system_slug: c.systemSlug,
            status: c.status === "active" ? "open" : "closed",
            priority: (c as { priority?: string }).priority || "medium",
            assigned_agent: (c as { assignedAgent?: { name: string; email: string } }).assignedAgent,
            tags: (c as { tags?: string[] }).tags || [],
            notes: ((c as { notes?: Array<{ id: string; content: string; author: string; createdAt: Date }> }).notes || []).map((n) => ({
                id: n.id,
                content: n.content,
                author: n.author,
                created_at: n.createdAt,
            })),
            created_at: c.createdAt,
            updated_at: c.updatedAt,
        })),
    };
};

export const getThreadMessagesService = async (threadId: string) => {
    const conversation = await Conversation.findOne({ publicId: threadId }).exec();
    if (!conversation) throw notFoundError("Thread not found");

    const messages = await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .lean()
        .exec();

    return {
        thread: {
            id: conversation.publicId,
            user_name: conversation.visitor?.name || "Guest User",
            user_email: conversation.visitor?.email,
            user_phone: conversation.visitor?.phone,
            status: conversation.status === "active" ? "open" : "closed",
            priority: (conversation as { priority?: string }).priority || "medium",
            assigned_agent: (conversation as { assignedAgent?: { name: string; email: string } }).assignedAgent,
            tags: conversation.tags || [],
            notes: (conversation.notes || []).map((n) => ({
                id: n.id,
                content: n.content,
                author: n.author,
                created_at: n.createdAt,
            })),
            system_slug: conversation.systemSlug,
            created_at: conversation.createdAt,
            updated_at: conversation.updatedAt,
        },
        messages: messages.map((m) => ({
            id: String(m._id),
            sender_type: m.senderType,
            content: m.content,
            attachments: m.attachments,
            created_at: m.createdAt,
        })),
    };
};

export interface UpdateSidebarPayload {
    visitor?: { name?: string; email?: string; phone?: string };
    priority?: "high" | "medium" | "low";
    status?: "active" | "ended";
    tagAction?: { action: "add" | "remove"; tag: string };
    noteAction?: { action: "add" | "delete"; content?: string; noteId?: string; author?: string };
}

export const updateThreadSidebarService = async (
    threadId: string,
    payload: UpdateSidebarPayload,
) => {
    const conversation = await Conversation.findOne({ publicId: threadId }).exec();
    if (!conversation) throw notFoundError("Thread not found");

    if (payload.visitor) {
        if (!conversation.visitor) {
            conversation.visitor = { name: "Guest User", email: "", phone: "" };
        }
        if (payload.visitor.name !== undefined) conversation.visitor.name = payload.visitor.name;
        if (payload.visitor.email !== undefined) conversation.visitor.email = payload.visitor.email;
        if (payload.visitor.phone !== undefined) conversation.visitor.phone = payload.visitor.phone;
    }

    if (payload.priority) {
        conversation.priority = payload.priority;
    }

    if (payload.status) {
        conversation.status = payload.status;
        if (payload.status === "ended") conversation.endedAt = new Date();
    }

    if (payload.tagAction) {
        const { action, tag } = payload.tagAction;
        const currentTags = conversation.tags || [];
        if (action === "add" && tag && !currentTags.includes(tag)) {
            conversation.tags.push(tag);
        } else if (action === "remove") {
            conversation.tags = currentTags.filter((t) => t !== tag);
        }
    }

    if (payload.noteAction) {
        const { action, content, noteId, author } = payload.noteAction;
        if (action === "add" && content && content.trim()) {
            conversation.notes.push({
                id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                content: content.trim(),
                author: author || "Support Agent",
                createdAt: new Date(),
            });
        } else if (action === "delete" && noteId) {
            const filteredNotes = conversation.notes.filter((n) => n.id !== noteId);
            conversation.set("notes", filteredNotes);
        }
    }

    await conversation.save();

    return {
        id: conversation.publicId,
        user_name: conversation.visitor?.name,
        user_email: conversation.visitor?.email,
        user_phone: conversation.visitor?.phone,
        status: conversation.status === "active" ? "open" : "closed",
        priority: conversation.priority,
        assigned_agent: conversation.assignedAgent,
        tags: conversation.tags || [],
        notes: (conversation.notes || []).map((n) => ({
            id: n.id,
            content: n.content,
            author: n.author,
            created_at: n.createdAt,
        })),
        system_slug: conversation.systemSlug,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
    };
};

export const assignThreadToAgentService = async (
    threadId: string,
    agentId: string,
    agentName: string,
    agentEmail: string,
) => {
    const conversation = await Conversation.findOneAndUpdate(
        { publicId: threadId },
        {
            $set: {
                assignedAgent: {
                    id: agentId,
                    name: agentName,
                    email: agentEmail,
                },
            },
        },
        { returnDocument: "after" },
    ).exec();

    if (!conversation) throw notFoundError("Thread not found");

    return {
        id: conversation.publicId,
        assigned_agent: conversation.assignedAgent,
    };
};

export const replyToThreadService = async (
    threadId: string,
    content: string,
    senderName: string = "Support Agent",
) => {
    const conversation = await Conversation.findOne({ publicId: threadId }).exec();
    if (!conversation) throw notFoundError("Thread not found");

    const message = await Message.create({
        conversationId: conversation._id,
        senderType: "assistant",
        content,
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
        $set: { updatedAt: new Date() },
    });

    return {
        id: String(message._id),
        thread_id: conversation.publicId,
        sender_name: senderName,
        sender_type: "assistant",
        content: message.content,
        created_at: message.createdAt,
    };
};

export const updateThreadStatusService = async (
    threadId: string,
    status?: "active" | "ended",
    priority?: "high" | "medium" | "low",
) => {
    const updates: Record<string, unknown> = {};

    if (status) {
        updates.status = status;
        if (status === "ended") updates.endedAt = new Date();
    }

    if (priority) {
        updates.priority = priority;
    }

    const conversation = await Conversation.findOneAndUpdate(
        { publicId: threadId },
        { $set: updates },
        { returnDocument: "after" },
    ).exec();

    if (!conversation) throw notFoundError("Thread not found");

    return {
        id: conversation.publicId,
        status: conversation.status === "active" ? "open" : "closed",
        priority: conversation.priority,
    };
};
