import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { KnowledgeFileProcessorFactory } from "../core/knowledge/file-processor.factory.js";
import { duplicateDisposition, validateUploadDescriptor } from "../core/knowledge/upload-policy.js";
import { conflictError, forbiddenError, internalServerError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { createDirectUploadAuthorization, destroyCloudinaryAsset, verifyCloudinaryAsset, type CloudinaryAsset } from "../lib/cloudinary.js";
import { KnowledgeSession, KnowledgeSource, KnowledgeUpload } from "../models/index.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { getWorkspace } from "./workspaces.js";

const UploadModel: any = KnowledgeUpload;
const SessionModel: any = KnowledgeSession;
const SourceModel: any = KnowledgeSource;
const MIN_CHUNK_SIZE = 6 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;

interface InitiateInput {
    name: string;
    mimeType: string;
    size: number;
    fingerprint: string;
}

const positiveConfigNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const maxBytes = () => positiveConfigNumber(process.env.CLOUDINARY_MAX_UPLOAD_BYTES, 500 * 1024 * 1024);
const chunkBytes = () => Math.max(MIN_CHUNK_SIZE, positiveConfigNumber(process.env.CLOUDINARY_CHUNK_SIZE, DEFAULT_CHUNK_SIZE));
const assertKnowledgeManager = (user: AuthenticatedUserContext) => {
    if (user.role === "agent") throw forbiddenError("Knowledge Base uploads require workspace administrator access.");
};
const fingerprintHash = (value: string) => createHash("sha256").update(value).digest("hex");
const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);

const serialize = (upload: any) => ({
    id: String(upload._id),
    upload_id: upload.uploadId,
    file_name: upload.fileName,
    size: upload.size,
    status: upload.status,
    bytes_uploaded: upload.bytesUploaded,
    asset_id: upload.assetId || undefined,
    secure_url: upload.secureUrl || undefined,
    error_code: upload.errorCode || undefined,
    error_message: upload.errorMessage || undefined,
});

const scopedUpload = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, uploadId: string) => {
    const workspace = await getWorkspace(user, workspaceSlug);
    const upload = await UploadModel.findOne({ uploadId, sessionId, workspaceId: workspace.id }).exec();
    if (!upload) throw notFoundError("Upload session not found.");
    return { workspace, upload };
};

const authorization = (upload: any) => ({
    ...serialize(upload),
    cloudinary: createDirectUploadAuthorization(upload.publicId, upload.resourceType),
    chunk_size: chunkBytes(),
    expires_at: upload.expiresAt,
});

export const initiateKnowledgeUpload = async (
    user: AuthenticatedUserContext,
    workspaceSlug: string,
    sessionId: string,
    input: InitiateInput,
) => {
    assertKnowledgeManager(user);
    const workspace = await getWorkspace(user, workspaceSlug);
    const session = await SessionModel.findOne({ _id: sessionId, workspaceId: workspace.id }).lean().exec();
    if (!session) throw notFoundError("Knowledge Base session not found.");
    const name = input.name?.trim();
    const mimeType = input.mimeType?.trim().toLowerCase() || "application/octet-stream";
    validateUploadDescriptor(name || "", input.size, maxBytes());
    const kind = KnowledgeFileProcessorFactory.kindForDescriptor(name, mimeType);
    const fingerprint = fingerprintHash(`${input.fingerprint}:${name}:${input.size}`);
    const existing = await UploadModel.findOne({ workspaceId: workspace.id, sessionId, fingerprint }).exec();
    const disposition = duplicateDisposition(existing?.status);
    if (existing && disposition === "duplicate") return { duplicate: true, ...serialize(existing) };
    if (existing && disposition === "resume") return { duplicate: false, resumed: true, ...authorization(existing) };
    if (existing) await UploadModel.deleteOne({ _id: existing._id });

    const uploadId = randomUUID();
    const resourceType = kind === "audio" || kind === "video" ? "video" : "raw";
    const rawExtension = resourceType === "raw" ? extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
    const publicId = `vizr/${safeSegment(String(workspace.id))}/knowledge/${safeSegment(sessionId)}/${uploadId}${rawExtension}`;
    try {
        const upload = await UploadModel.create({
            workspaceId: workspace.id, sessionId, createdBy: user.id, uploadId, fingerprint,
            fileName: name, mimeType, kind, size: input.size, publicId,
            resourceType,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        return { duplicate: false, resumed: false, ...authorization(upload) };
    } catch (error: any) {
        if (error?.code !== 11000) throw error;
        const raced = await UploadModel.findOne({ workspaceId: workspace.id, sessionId, fingerprint }).exec();
        if (!raced) throw error;
        if (raced.status === "COMPLETED") return { duplicate: true, ...serialize(raced) };
        return { duplicate: false, resumed: true, ...authorization(raced) };
    }
};

export const refreshKnowledgeUpload = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, uploadId: string) => {
    assertKnowledgeManager(user);
    const { upload } = await scopedUpload(user, workspaceSlug, sessionId, uploadId);
    if (!["INITIATED", "UPLOADING"].includes(upload.status)) throw conflictError(`Upload is already ${upload.status.toLowerCase()}.`);
    upload.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await upload.save();
    return authorization(upload);
};

export const recordKnowledgeUploadProgress = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, uploadId: string, bytes: number) => {
    assertKnowledgeManager(user);
    const { upload } = await scopedUpload(user, workspaceSlug, sessionId, uploadId);
    if (!["INITIATED", "UPLOADING"].includes(upload.status)) return serialize(upload);
    upload.status = "UPLOADING";
    upload.bytesUploaded = Math.max(upload.bytesUploaded, Math.min(Number(bytes) || 0, upload.size));
    await upload.save();
    return serialize(upload);
};

const finalizeVerifiedUpload = async (upload: any, asset: CloudinaryAsset) => {
    if (upload.status === "COMPLETED") return serialize(upload);
    const authorizedExtension = upload.resourceType === "raw" ? extname(upload.fileName).toLowerCase() : "";
    const authorizedPublicIds = [upload.publicId, authorizedExtension ? `${upload.publicId}${authorizedExtension}` : ""];
    if (!authorizedPublicIds.includes(asset.public_id) || asset.bytes !== upload.size) {
        upload.status = "FAILED";
        upload.errorCode = "ASSET_MISMATCH";
        upload.errorMessage = "Cloudinary asset metadata did not match the authorized file.";
        await upload.save();
        await destroyCloudinaryAsset(upload.resourceType, upload.publicId).catch(() => undefined);
        throw unprocessableEntityError(upload.errorMessage);
    }
    try {
        const source = await SourceModel.findOneAndUpdate(
            { workspaceId: upload.workspaceId, uploadId: upload.uploadId },
            { $setOnInsert: { workspaceId: upload.workspaceId, sessionId: upload.sessionId, name: upload.fileName, mimeType: upload.mimeType, kind: upload.kind, size: upload.size, status: "processing", uploadId: upload.uploadId, cloudinaryAssetId: asset.asset_id, cloudinaryPublicId: asset.public_id, secureUrl: asset.secure_url } },
            { upsert: true, new: true },
        ).exec();
        if (!source) throw internalServerError("Knowledge source metadata could not be created.");
    } catch (error) {
        await destroyCloudinaryAsset(upload.resourceType, upload.publicId).catch(() => undefined);
        upload.status = "FAILED";
        upload.errorCode = "DATABASE_FAILURE";
        upload.errorMessage = "Asset metadata could not be persisted and the uploaded asset was cleaned up.";
        await upload.save().catch(() => undefined);
        throw error;
    }
    upload.status = "COMPLETED";
    upload.assetId = asset.asset_id;
    upload.secureUrl = asset.secure_url;
    upload.cloudinaryVersion = asset.version;
    upload.bytesUploaded = asset.bytes;
    upload.completedAt = new Date();
    upload.expiresAt = undefined;
    await upload.save();
    const [sourceCount, readySourceCount] = await Promise.all([
        SourceModel.countDocuments({ sessionId: upload.sessionId }),
        SourceModel.countDocuments({ sessionId: upload.sessionId, status: "ready" }),
    ]);
    await SessionModel.updateOne({ _id: upload.sessionId }, { sourceCount, readySourceCount, status: "processing" });
    return serialize(upload);
};

export const completeKnowledgeUploadFromWebhook = async (asset: CloudinaryAsset) => {
    const publicIdWithoutRawExtension = asset.resource_type === "raw" ? asset.public_id.replace(/\.[^.]+$/, "") : asset.public_id;
    const upload = await UploadModel.findOne({ publicId: { $in: [asset.public_id, publicIdWithoutRawExtension] } }).exec();
    if (!upload) return { ignored: true };
    if (upload.status === "CANCELLED") {
        await destroyCloudinaryAsset(upload.resourceType, upload.publicId).catch(() => undefined);
        return { ignored: true };
    }
    return finalizeVerifiedUpload(upload, asset);
};

export const completeKnowledgeUpload = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, uploadId: string) => {
    assertKnowledgeManager(user);
    const { upload } = await scopedUpload(user, workspaceSlug, sessionId, uploadId);
    if (upload.status === "COMPLETED") return serialize(upload);
    if (upload.status === "CANCELLED") throw conflictError("A cancelled upload cannot be completed.");
    const asset = await verifyCloudinaryAsset(upload.resourceType, upload.publicId, upload.fileName);
    return finalizeVerifiedUpload(upload, asset);
};

export const cancelKnowledgeUpload = async (user: AuthenticatedUserContext, workspaceSlug: string, sessionId: string, uploadId: string) => {
    assertKnowledgeManager(user);
    const { upload } = await scopedUpload(user, workspaceSlug, sessionId, uploadId);
    if (upload.status === "COMPLETED") throw conflictError("A completed upload cannot be cancelled.");
    upload.status = "CANCELLED";
    upload.cancelledAt = new Date();
    upload.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await upload.save();
    await destroyCloudinaryAsset(upload.resourceType, upload.publicId).catch(() => undefined);
    return serialize(upload);
};
