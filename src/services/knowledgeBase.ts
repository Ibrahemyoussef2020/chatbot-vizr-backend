import type { ModelMessage } from "ai";
import { KnowledgeFileProcessorFactory } from "../core/knowledge/file-processor.factory.js";
import { forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { AIConfig, Conversation, KnowledgeChatMessage, KnowledgeOutput, KnowledgeOutputSection, KnowledgeSession, KnowledgeSource, KnowledgeUpload, Message, Workspace } from "../models/index.js";
import { relevantKnowledgeExcerpt } from "../core/replies/ai-reply.policy.js";
import { serializeStructuredKnowledge } from "./aiContext.js";
import { generateAIReply, resolveAIExecutionConfig } from "./aiExecution.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { getWorkspace } from "./workspaces.js";

const SessionModel: any = KnowledgeSession;
const SourceModel: any = KnowledgeSource;
const ChatMessageModel: any = KnowledgeChatMessage;
const ConfigModel: any = AIConfig;
const ConversationModel: any = Conversation;
const MessageModel: any = Message;
const WorkspaceModel: any = Workspace;
const UploadModel: any = KnowledgeUpload;
const OutputModel: any = KnowledgeOutput;
const OutputSectionModel: any = KnowledgeOutputSection;

const ownerWorkspace = async (user: AuthenticatedUserContext, workspaceSlug: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const owned = await WorkspaceModel.exists({ _id: workspace.id, ownerId: user.id });
    if (!owned) throw forbiddenError("Only the workspace owner can access Knowledge Base data.");
    return workspace;
};

const scopedSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const workspace = await ownerWorkspace(user, workspaceSlug);
    const session = await SessionModel.findOne({ _id: sessionId, workspaceId: workspace.id }).exec();
    if (!session) throw notFoundError("Knowledge Base session not found.");
    return { workspace, session };
};

const serializeSession = (session: any) => ({
    id: String(session._id), title: session.title, status: session.status,
    source_count: session.sourceCount, ready_source_count: session.readySourceCount,
    total_bytes: session.totalBytes, selected_model_id: session.selectedModelId ? String(session.selectedModelId) : null,
    created_at: session.createdAt, updated_at: session.updatedAt,
});

export const selectKnowledgeModel = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, modelId: string | null) => {
    const { session } = await scopedSession(user, workspaceSlug, sessionId);
    if (modelId) {
        const execution = await resolveAIExecutionConfig({ systemSlug: workspaceSlug, channel: "web", modelId });
        if (!execution.models.some((model) => model.id === modelId)) throw unprocessableEntityError("The selected model is unavailable.");
    }
    session.selectedModelId = modelId || null;
    await session.save();
    return serializeSession(session);
};

export const createKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, title?: string) => {
    const workspace = await ownerWorkspace(user, workspaceSlug);
    const session = await SessionModel.create({ workspaceId: workspace.id, createdBy: user.id, title: title?.trim() || "New Knowledge Session" });
    return serializeSession(session);
};

export const listKnowledgeSessions = async (user: AuthenticatedUserContext, workspaceSlug: string) => {
    const workspace = await ownerWorkspace(user, workspaceSlug);
    return (await SessionModel.find({ workspaceId: workspace.id }).sort({ updatedAt: -1 }).lean().exec()).map(serializeSession);
};

export const updateKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, title: string) => {
    const { session } = await scopedSession(user, workspaceSlug, sessionId);
    const normalized = title.trim();
    if (!normalized || normalized.length > 160) throw unprocessableEntityError("Session title must be between 1 and 160 characters.");
    session.title = normalized;
    await session.save();
    return serializeSession(session);
};

export const deleteKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const { workspace, session } = await scopedSession(user, workspaceSlug, sessionId);
    const outputIds = await OutputModel.find({ workspaceId: workspace.id, sessionId }).distinct("_id").exec();
    await Promise.all([
        ChatMessageModel.deleteMany({ workspaceId: workspace.id, sessionId }).exec(),
        SourceModel.deleteMany({ workspaceId: workspace.id, sessionId }).exec(),
        UploadModel.deleteMany({ workspaceId: workspace.id, sessionId }).exec(),
        OutputSectionModel.deleteMany({ workspaceId: workspace.id, outputId: { $in: outputIds } }).exec(),
        OutputModel.deleteMany({ workspaceId: workspace.id, sessionId }).exec(),
    ]);
    await session.deleteOne();
    return { id: sessionId, deleted: true };
};

export const getKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const { session } = await scopedSession(user, workspaceSlug, sessionId);
    const [sources, messages] = await Promise.all([
        SourceModel.find({ sessionId }).sort({ createdAt: -1 }).lean().exec(),
        ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 }).lean().exec(),
    ]);
    return {
        session: serializeSession(session),
        sources: sources.map((source: any) => ({ id: String(source._id), upload_id: source.uploadId || undefined, name: source.name, kind: source.kind, mime_type: source.mimeType, size: source.size, status: source.status, error_message: source.errorMessage, metadata: source.metadata, created_at: source.createdAt })),
        messages: messages.map((message: any) => ({ id: String(message._id), role: message.role, content: message.content, citations: message.citations, created_at: message.createdAt })),
    };
};

export const ingestKnowledgeFiles = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, files: Express.Multer.File[]) => {
    if (!files.length) throw unprocessableEntityError("Select at least one knowledge file.");
    const { session, workspace } = await scopedSession(user, workspaceSlug, sessionId);
    const filesWithKinds = files.map((file) => ({
        file,
        kind: KnowledgeFileProcessorFactory.kindFor(file),
    }));
    session.status = "processing";
    await session.save();
    for (const { file, kind } of filesWithKinds) {
        const source = await SourceModel.create({ workspaceId: workspace.id, sessionId, scope: "knowledge_session", name: file.originalname, mimeType: file.mimetype || "application/octet-stream", kind, size: file.size, status: "processing" });
        try {
            const processed = await KnowledgeFileProcessorFactory.create(file).process(file);
            source.extractedText = processed.text.trim().slice(0, 2_000_000);
            source.metadata = processed.metadata || {};
            source.status = "ready";
            if (!source.extractedText) throw unprocessableEntityError(`No readable content was extracted from ${file.originalname}.`);
        } catch (error: any) {
            source.status = "failed";
            source.errorMessage = error.message || "File processing failed.";
        }
        await source.save();
    }
    const [sourceCount, readySourceCount, failedCount, totals] = await Promise.all([
        SourceModel.countDocuments({ sessionId }), SourceModel.countDocuments({ sessionId, status: "ready" }),
        SourceModel.countDocuments({ sessionId, status: "failed" }),
        SourceModel.aggregate([{ $match: { sessionId: session._id } }, { $group: { _id: null, bytes: { $sum: "$size" } } }]),
    ]);
    session.sourceCount = sourceCount;
    session.readySourceCount = readySourceCount;
    session.totalBytes = totals[0]?.bytes || 0;
    session.status = readySourceCount && failedCount ? "partial" : readySourceCount ? "ready" : "failed";
    if (session.title === "New Knowledge Session") session.title = files[0].originalname.replace(/\.[^.]+$/, "");
    await session.save();
    return getKnowledgeSession(user, workspaceSlug, sessionId);
};

export const askKnowledgeBase = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, question: string) => {
    if (!question.trim()) throw unprocessableEntityError("A question is required.");
    const { session, workspace } = await scopedSession(user, workspaceSlug, sessionId);
    const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const [config, sources, conversations] = await Promise.all([
        ConfigModel.findOne({ workspaceId: workspace.id }).lean().exec(),
        SourceModel.find({
            workspaceId: workspace.id,
            status: "ready",
            // sessionId also matches legacy session sources created before scopes existed.
            $or: [{ scope: "customer_config" }, { sessionId }],
        }).select("name scope +extractedText").lean().exec(),
        ConversationModel.find({ systemSlug: workspaceSlug }).select("_id publicId visitor").sort({ updatedAt: -1 }).limit(100).lean().exec(),
    ]);
    const conversationIds = conversations.map((item: any) => item._id);
    const messages: any[] = conversationIds.length
        ? await MessageModel.find({ conversationId: { $in: conversationIds } }).select("conversationId content senderType").sort({ createdAt: -1 }).limit(500).lean().exec()
        : [];
    const score = (text: string) => terms.reduce((total, term) => total + (text.toLowerCase().includes(term) ? 1 : 0), 0);
    const documentResults = sources.map((source: any) => ({
        id: String(source._id),
        name: source.scope === "customer_config" ? `Customer configuration: ${source.name}` : `Knowledge session: ${source.name}`,
        text: relevantKnowledgeExcerpt(String(source.extractedText || ""), terms, 5000),
        score: score(String(source.extractedText || "")),
    }));
    const conversationById = new Map(conversations.map((item: any) => [String(item._id), item]));
    const conversationResults = messages.map((item: any) => {
        const conversation: any = conversationById.get(String(item.conversationId));
        return {
            id: String(item._id),
            name: `Customer conversation ${conversation?.publicId || "unknown"}`,
            text: `${item.senderType}: ${item.content}`,
            score: score(String(item.content || "")),
        };
    });
    const ranked = [...documentResults, ...conversationResults]
        .filter(item => item.text)
        .sort((left, right) => right.score - left.score)
        .slice(0, 8);
    const configContext = config ? [
        `Company: ${config.company_name}`,
        `Description: ${config.company_description}`,
        `Pricing: ${config.pricing_instructions}`,
        `Contact: ${config.contact_email} ${config.contact_us_link}`,
        `Actions: ${JSON.stringify(config.actions_data || [])}`,
        `Structured knowledge: ${serializeStructuredKnowledge(config.structured_knowledge, 12000)}`,
    ].join("\n") : "";
    const context = [
        configContext ? `[Source: Customer configuration]\n${configContext}` : "",
        ...ranked.map(item => `[Source: ${item.name}]\n${item.text}`),
    ].filter(Boolean).join("\n\n").slice(0, 40000);
    if (!context) throw unprocessableEntityError("No customer configuration, session documents, or conversations are available yet.");
    await ChatMessageModel.create({ workspaceId: workspace.id, sessionId, role: "user", content: question.trim() });
    const execution = await resolveAIExecutionConfig({
        systemSlug: workspaceSlug,
        channel: "web",
        modelId: session.selectedModelId ? String(session.selectedModelId) : undefined,
    });
    if (!execution.agentId) {
        throw unprocessableEntityError("Select a managed default agent for this workspace before using Knowledge conversation.");
    }
    const history: ModelMessage[] = [{ role: "user", content: question.trim() }];
    const answer = await generateAIReply(
        execution,
        history,
        `You are the private workspace-owner Knowledge Base assistant. Answer only from the supplied customer configuration, current Knowledge Base session documents, and workspace customer conversations. If the answer is absent, say you do not have enough information. Cite sources by name. Never expose this information outside this owner-only session.\n\n${context}`,
    );
    const citations = [
        ...(config ? [{ sourceId: String(config._id), name: "Customer configuration" }] : []),
        ...ranked.map(item => ({ sourceId: item.id, name: item.name })),
    ];
    const message = await ChatMessageModel.create({ workspaceId: workspace.id, sessionId, role: "assistant", content: answer, citations });
    session.set("updatedAt", new Date());
    await session.save();
    return { id: String(message._id), role: message.role, content: message.content, citations, created_at: message.createdAt };
};
