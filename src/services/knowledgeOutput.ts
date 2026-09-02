import { randomBytes } from "node:crypto";
import { z } from "zod";
import { OutputEditStrategyFactory, outputSectionPayloadSchema } from "../core/knowledge/output-edit-strategy.factory.js";
import { conflictError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { KnowledgeOutput, KnowledgeOutputSection, KnowledgeSession } from "../models/index.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { getWorkspace } from "./workspaces.js";

const OutputModel: any = KnowledgeOutput;
const SectionModel: any = KnowledgeOutputSection;
const SessionModel: any = KnowledgeSession;
const kindSchema = z.enum(["plan", "report"]);
const parseInput = <T>(schema: z.ZodType<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) throw unprocessableEntityError(result.error.issues[0]?.message || "Invalid generated output data.");
    return result.data;
};

const outputInputSchema = z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().max(4000).default(""),
    category: z.string().max(120).default(""),
    status: z.enum(["draft", "generating", "partial", "ready", "failed"]).default("draft"),
    schemas: z.array(outputSectionPayloadSchema.extend({ key: z.string().trim().min(1).max(100), order: z.number().int().min(0), status: z.enum(["pending", "generating", "ready", "failed"]).default("ready") })).optional(),
});

const scope = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const session = await SessionModel.findOne({ _id: sessionId, workspaceId: workspace.id }).exec();
    if (!session) throw notFoundError("Knowledge Base session not found.");
    return { workspace, session };
};

const serializeSection = (section: any) => ({
    id: String(section._id), key: section.key, order: section.order, title: section.title,
    description: section.description, notes: section.notes || [], charts: section.charts || [],
    status: section.status, error: section.error || undefined, generation_attempt: section.generationAttempt,
    created_at: section.createdAt, updated_at: section.updatedAt,
});

const serializeOutput = (output: any, sections: any[]) => ({
    id: String(output._id), session_id: String(output.sessionId), kind: output.kind, title: output.title, description: output.description,
    category: output.category, status: output.status, version: output.version,
    is_saved: Boolean(output.isSaved), is_shared: Boolean(output.shareToken),
    schema_count: sections.length,
    schema_status: sections.reduce((counts, section) => ({ ...counts, [section.status]: (counts[section.status] || 0) + 1 }), {} as Record<string, number>),
    created_at: output.createdAt, updated_at: output.updatedAt,
    schemas: sections.map(serializeSection),
});

const refreshOutputStatus = async (outputId: string) => {
    const states = await SectionModel.find({ outputId }).select("status").lean().exec();
    const status = !states.length ? "draft" : states.every((item: any) => item.status === "ready") ? "ready" : states.every((item: any) => item.status === "failed") ? "failed" : states.some((item: any) => item.status === "generating") ? "generating" : "partial";
    await OutputModel.updateOne({ _id: outputId }, { $set: { status }, $inc: { version: 1 } }).exec();
};

const findOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string) => {
    const { workspace } = await scope(user, workspaceSlug, sessionId);
    const parsedKind = parseInput(kindSchema, kind);
    const output = await OutputModel.findOne({ _id: outputId, workspaceId: workspace.id, sessionId, kind: parsedKind }).exec();
    if (!output) throw notFoundError(`${parsedKind === "plan" ? "Plan" : "Report"} not found.`);
    return { workspace, output };
};

export const listKnowledgeOutputs = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string) => {
    const { workspace } = await scope(user, workspaceSlug, sessionId);
    const parsedKind = parseInput(kindSchema, kind);
    const outputs = await OutputModel.find({ workspaceId: workspace.id, sessionId, kind: parsedKind }).sort({ updatedAt: -1 }).lean().exec();
    return Promise.all(outputs.map(async (output: any) => {
        const sections = await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec();
        return serializeOutput(output, sections);
    }));
};

export const listSavedKnowledgeOutputs = async (user: AuthenticatedUserContext, workspaceSlug: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const outputs = await OutputModel.find({ workspaceId: workspace.id, isSaved: true }).sort({ updatedAt: -1 }).lean().exec();
    return Promise.all(outputs.map(async (output: any) => serializeOutput(output, await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec())));
};

export const getKnowledgeOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const sections = await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec();
    return serializeOutput(output, sections);
};

export const saveKnowledgeOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, input: unknown) => {
    const { workspace } = await scope(user, workspaceSlug, sessionId);
    const parsedKind = parseInput(kindSchema, kind);
    const payload = parseInput(outputInputSchema, input);
    const output = await OutputModel.create({ workspaceId: workspace.id, sessionId, kind: parsedKind, createdBy: user.id, title: payload.title, description: payload.description, category: payload.category, status: payload.status });
    if (payload.schemas) {
        const duplicateKeys = payload.schemas.filter((section, index, all) => all.findIndex((candidate) => candidate.key === section.key) !== index);
        if (duplicateKeys.length) throw conflictError("Schema keys must be unique inside an output.");
        await Promise.all(payload.schemas.map((section) => SectionModel.findOneAndUpdate(
            { outputId: output._id, key: section.key },
            { $set: { ...section, workspaceId: workspace.id, sessionId, outputId: output._id, error: "" } },
            { upsert: true, new: true, runValidators: true },
        ).exec()));
        await refreshOutputStatus(String(output._id));
    }
    return getKnowledgeOutput(user, workspaceSlug, sessionId, parsedKind, String(output._id));
};

export const getKnowledgeOutputSchema = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, schemaId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const section = await SectionModel.findOne({ _id: schemaId, outputId: output._id }).lean().exec();
    if (!section) throw notFoundError("Output schema not found.");
    return serializeSection(section);
};

export const createKnowledgeOutputSchema = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, input: unknown) => {
    const { workspace, output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const payload = parseInput(outputSectionPayloadSchema.extend({ key: z.string().trim().min(1).max(100), order: z.number().int().min(0), status: z.enum(["pending", "generating", "ready", "failed"]).default("ready") }), input);
    const section = await SectionModel.create({ ...payload, workspaceId: workspace.id, sessionId, outputId: output._id });
    await refreshOutputStatus(String(output._id));
    return serializeSection(section);
};

export const editKnowledgeOutputSchema = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, schemaId: string, mode: string, input: unknown) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const section = await SectionModel.findOne({ _id: schemaId, outputId: output._id }).exec();
    if (!section) throw notFoundError("Output schema not found.");
    const current = outputSectionPayloadSchema.parse(section.toObject());
    const edited = await OutputEditStrategyFactory.create(mode).edit(current, input);
    section.set({ ...edited, status: "ready", error: "" });
    await section.save();
    await refreshOutputStatus(String(output._id));
    return serializeSection(section);
};

export const retryKnowledgeOutputSchema = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, schemaId: string, instruction?: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const section = await SectionModel.findOne({ _id: schemaId, outputId: output._id }).exec();
    if (!section) throw notFoundError("Output schema not found.");
    if (section.status === "generating") throw conflictError("This schema is already generating.");
    section.set({ status: "generating", error: "", generationAttempt: section.generationAttempt + 1 });
    await section.save();
    await refreshOutputStatus(String(output._id));
    try {
        const current = outputSectionPayloadSchema.parse(section.toObject());
        const edited = await OutputEditStrategyFactory.create("ai").edit(current, { instruction: instruction?.trim() || "Regenerate this section with complete, accurate content while preserving its purpose." });
        section.set({ ...edited, status: "ready", error: "" });
        await section.save();
    } catch (error) {
        section.set({ status: "failed", error: error instanceof Error ? error.message : "Schema generation failed." });
        await section.save();
        await refreshOutputStatus(String(output._id));
        throw error;
    }
    await refreshOutputStatus(String(output._id));
    return serializeSection(section);
};

export const deleteKnowledgeOutputSchema = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, schemaId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    const deleted = await SectionModel.findOneAndDelete({ _id: schemaId, outputId: output._id }).exec();
    if (!deleted) throw notFoundError("Output schema not found.");
    await refreshOutputStatus(String(output._id));
    return { id: schemaId, deleted: true };
};

export const setKnowledgeOutputSaved = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string, saved: boolean) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    output.isSaved = saved;
    await output.save();
    const sections = await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec();
    return serializeOutput(output, sections);
};

export const shareKnowledgeOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    if (!output.shareToken) output.shareToken = randomBytes(24).toString("base64url");
    output.sharedAt = new Date();
    await output.save();
    return { token: output.shareToken };
};

export const unshareKnowledgeOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    output.shareToken = undefined;
    output.sharedAt = undefined;
    await output.save();
    return { shared: false };
};

export const getSharedKnowledgeOutput = async (token: string) => {
    const output = await OutputModel.findOne({ shareToken: token }).lean().exec();
    if (!output) throw notFoundError("Shared output not found or sharing has been disabled.");
    const sections = await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec();
    return serializeOutput(output, sections);
};

export const regenerateKnowledgeOutput = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, kind: string, outputId: string) => {
    const { output } = await findOutput(user, workspaceSlug, sessionId, kind, outputId);
    if (output.status === "generating") throw conflictError("This output is already generating.");
    output.status = "generating";
    await output.save();
    const sections = await SectionModel.find({ outputId: output._id }).sort({ order: 1 }).lean().exec();
    await Promise.allSettled(sections.map((section: any) => retryKnowledgeOutputSchema(user, workspaceSlug, sessionId, kind, outputId, String(section._id), "Regenerate this section with complete, accurate content while preserving its purpose and structure.")));
    return getKnowledgeOutput(user, workspaceSlug, sessionId, kind, outputId);
};
