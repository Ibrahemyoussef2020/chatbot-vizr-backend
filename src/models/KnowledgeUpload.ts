import { Schema, model } from "mongoose";

const KnowledgeUploadSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "KnowledgeSession", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    uploadId: { type: String, required: true, unique: true, index: true },
    fingerprint: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    kind: { type: String, enum: ["pdf", "audio", "video", "excel", "text"], required: true },
    size: { type: Number, required: true },
    status: { type: String, enum: ["INITIATED", "UPLOADING", "COMPLETED", "FAILED", "CANCELLED"], default: "INITIATED", index: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["raw", "video"], required: true },
    assetId: { type: String, default: "" },
    secureUrl: { type: String, default: "" },
    bytesUploaded: { type: Number, default: 0 },
    cloudinaryVersion: { type: Number },
    errorCode: { type: String, default: "" },
    errorMessage: { type: String, default: "" },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    expiresAt: { type: Date, index: { expires: 0 } },
}, { timestamps: true });

KnowledgeUploadSchema.index({ workspaceId: 1, sessionId: 1, fingerprint: 1 }, { unique: true });

export default model("KnowledgeUpload", KnowledgeUploadSchema);
