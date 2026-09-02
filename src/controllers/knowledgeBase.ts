import type { NextFunction, Request, Response } from "express";
import {
    askKnowledgeBase,
    createKnowledgeSession,
    getKnowledgeSession,
    ingestKnowledgeFiles,
    listKnowledgeSessions,
} from "../services/knowledgeBase.js";
import {
    cancelKnowledgeUpload,
    completeKnowledgeUpload,
    initiateKnowledgeUpload,
    recordKnowledgeUploadProgress,
    refreshKnowledgeUpload,
} from "../services/knowledgeUpload.js";
import {
    createKnowledgeOutputSchema,
    deleteKnowledgeOutputSchema,
    editKnowledgeOutputSchema,
    getKnowledgeOutput,
    listKnowledgeOutputs,
    listSavedKnowledgeOutputs,
    getKnowledgeOutputSchema,
    getSharedKnowledgeOutput,
    generateKnowledgeOutput,
    regenerateKnowledgeOutput,
    retryKnowledgeOutputSchema,
    saveKnowledgeOutput,
    setKnowledgeOutputSaved,
    shareKnowledgeOutput,
    unshareKnowledgeOutput,
} from "../services/knowledgeOutput.js";

const parseSlug = (req: Request) => String(
    req.query.system_slug || req.body?.system_slug || "",
);

const parseId = (req: Request) => String(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
);

export const listSessions = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await listKnowledgeSessions(res.locals.user, parseSlug(req));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const createSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await createKnowledgeSession(
            res.locals.user,
            parseSlug(req),
            req.body?.title,
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const showSession = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await getKnowledgeSession(
            res.locals.user,
            parseSlug(req),
            parseId(req),
        );
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const uploadSources = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const data = await ingestKnowledgeFiles(
            res.locals.user,
            parseSlug(req),
            parseId(req),
            files,
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const chat = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const data = await askKnowledgeBase(
            res.locals.user,
            parseSlug(req),
            parseId(req),
            String(req.body?.question || ""),
        );
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const initiateUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await initiateKnowledgeUpload(res.locals.user, parseSlug(req), parseId(req), {
            name: String(req.body?.name || ""),
            mimeType: String(req.body?.mime_type || ""),
            size: Number(req.body?.size),
            fingerprint: String(req.body?.fingerprint || ""),
        });
        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const refreshUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await refreshKnowledgeUpload(res.locals.user, parseSlug(req), parseId(req), String(req.params.uploadId));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const uploadProgress = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await recordKnowledgeUploadProgress(res.locals.user, parseSlug(req), parseId(req), String(req.params.uploadId), Number(req.body?.bytes));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const completeUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await completeKnowledgeUpload(res.locals.user, parseSlug(req), parseId(req), String(req.params.uploadId));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const cancelUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await cancelKnowledgeUpload(res.locals.user, parseSlug(req), parseId(req), String(req.params.uploadId));
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const outputArgs = (req: Request) => ({ sessionId: parseId(req), kind: String(req.params.kind), outputId: String(req.params.outputId || ""), schemaId: String(req.params.schemaId || "") });

export const listOutputs = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind } = outputArgs(req); res.json({ success: true, data: await listKnowledgeOutputs(res.locals.user, parseSlug(req), sessionId, kind) }); }
    catch (error) { next(error); }
};

export const listSavedOutputs = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await listSavedKnowledgeOutputs(res.locals.user, parseSlug(req)) }); }
    catch (error) { next(error); }
};

export const showOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.json({ success: true, data: await getKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, outputId) }); }
    catch (error) { next(error); }
};

export const saveOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind } = outputArgs(req); res.status(201).json({ success: true, data: await saveKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, req.body) }); }
    catch (error) { next(error); }
};

export const generateOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind } = outputArgs(req); res.status(201).json({ success: true, data: await generateKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, req.body) }); }
    catch (error) { next(error); }
};

export const showOutputSchema = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId, schemaId } = outputArgs(req); res.json({ success: true, data: await getKnowledgeOutputSchema(res.locals.user, parseSlug(req), sessionId, kind, outputId, schemaId) }); }
    catch (error) { next(error); }
};

export const createOutputSchema = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.status(201).json({ success: true, data: await createKnowledgeOutputSchema(res.locals.user, parseSlug(req), sessionId, kind, outputId, req.body) }); }
    catch (error) { next(error); }
};

export const editOutputSchema = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId, schemaId } = outputArgs(req); res.json({ success: true, data: await editKnowledgeOutputSchema(res.locals.user, parseSlug(req), sessionId, kind, outputId, schemaId, String(req.body?.mode || "manual"), req.body?.data ?? req.body) }); }
    catch (error) { next(error); }
};

export const retryOutputSchema = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId, schemaId } = outputArgs(req); res.json({ success: true, data: await retryKnowledgeOutputSchema(res.locals.user, parseSlug(req), sessionId, kind, outputId, schemaId, req.body?.instruction) }); }
    catch (error) { next(error); }
};

export const removeOutputSchema = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId, schemaId } = outputArgs(req); res.json({ success: true, data: await deleteKnowledgeOutputSchema(res.locals.user, parseSlug(req), sessionId, kind, outputId, schemaId) }); }
    catch (error) { next(error); }
};

export const saveOutputFavorite = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.json({ success: true, data: await setKnowledgeOutputSaved(res.locals.user, parseSlug(req), sessionId, kind, outputId, Boolean(req.body?.saved)) }); }
    catch (error) { next(error); }
};

export const regenerateOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.json({ success: true, data: await regenerateKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, outputId) }); }
    catch (error) { next(error); }
};

export const shareOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.status(201).json({ success: true, data: await shareKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, outputId) }); }
    catch (error) { next(error); }
};

export const unshareOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { const { sessionId, kind, outputId } = outputArgs(req); res.json({ success: true, data: await unshareKnowledgeOutput(res.locals.user, parseSlug(req), sessionId, kind, outputId) }); }
    catch (error) { next(error); }
};

export const showSharedOutput = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await getSharedKnowledgeOutput(String(req.params.token || "")) }); }
    catch (error) { next(error); }
};
