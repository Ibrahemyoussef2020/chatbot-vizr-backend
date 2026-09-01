import { AIFactory } from "../core/ai-gateway/ai-gateway.factory.js";
import { KnowledgeFileProcessorFactory } from "../core/knowledge/file-processor.factory.js";
import { notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { KnowledgeChatMessage, KnowledgeSession, KnowledgeSource } from "../models/index.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { getWorkspace } from "./workspaces.js";

const SessionModel: any = KnowledgeSession;
const SourceModel: any = KnowledgeSource;
const ChatMessageModel: any = KnowledgeChatMessage;

const scopedSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const session = await SessionModel.findOne({ _id: sessionId, workspaceId: workspace.id }).exec();
    if (!session) throw notFoundError("Knowledge Base session not found.");
    return { workspace, session };
};

const serializeSession = (session: any) => ({
    id: String(session._id), title: session.title, status: session.status,
    source_count: session.sourceCount, ready_source_count: session.readySourceCount,
    total_bytes: session.totalBytes, created_at: session.createdAt, updated_at: session.updatedAt,
});

export const createKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, title?: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const session = await SessionModel.create({ workspaceId: workspace.id, createdBy: user.id, title: title?.trim() || "New Knowledge Session" });
    return serializeSession(session);
};

export const listKnowledgeSessions = async (user: AuthenticatedUserContext, workspaceSlug: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    return (await SessionModel.find({ workspaceId: workspace.id }).sort({ updatedAt: -1 }).lean().exec()).map(serializeSession);
};

export const getKnowledgeSession = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const { session } = await scopedSession(user, workspaceSlug, sessionId);
    const [sources, messages] = await Promise.all([
        SourceModel.find({ sessionId }).sort({ createdAt: -1 }).lean().exec(),
        ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 }).lean().exec(),
    ]);
    return {
        session: serializeSession(session),
        sources: sources.map((source: any) => ({ id: String(source._id), name: source.name, kind: source.kind, mime_type: source.mimeType, size: source.size, status: source.status, error_message: source.errorMessage, metadata: source.metadata, created_at: source.createdAt })),
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
        const source = await SourceModel.create({ workspaceId: workspace.id, sessionId, name: file.originalname, mimeType: file.mimetype || "application/octet-stream", kind, size: file.size, status: "processing" });
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
    const sources: any[] = await SourceModel.find({ sessionId, status: "ready" }).select("+extractedText").lean().exec();
    if (!sources.length) throw unprocessableEntityError("Upload and process at least one source before chatting.");
    const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const ranked = sources.map((source) => ({ source, score: terms.reduce((score, term) => score + (source.extractedText.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score).slice(0, 5);
    const context = ranked.map(({ source }, index) => `[Source ${index + 1}: ${source.name}]\n${source.extractedText.slice(0, 8000)}`).join("\n\n");
    await ChatMessageModel.create({ workspaceId: workspace.id, sessionId, role: "user", content: question.trim() });
    const ai = AIFactory.getProvider((process.env.DEFAULT_AI_PROVIDER || "vercel").trim());
    const answer = await ai.generate(question.trim(), { systemPrompt: `Answer only from the supplied workspace knowledge. If the answer is absent, say you do not have enough information. Cite sources by name.\n\n${context}` });
    const citations = ranked.map(({ source }) => ({ sourceId: String(source._id), name: source.name }));
    const message = await ChatMessageModel.create({ workspaceId: workspace.id, sessionId, role: "assistant", content: answer, citations });
    session.set("updatedAt", new Date());
    await session.save();
    return { id: String(message._id), role: message.role, content: message.content, citations, created_at: message.createdAt };
};
