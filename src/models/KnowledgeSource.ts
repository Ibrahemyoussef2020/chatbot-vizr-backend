import { Schema, model } from "mongoose";

const KnowledgeSourceSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "KnowledgeSession", required: true, index: true },
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    kind: { type: String, enum: ["pdf", "audio", "video", "excel", "text"], required: true, index: true },
    size: { type: Number, required: true },
    status: { type: String, enum: ["processing", "ready", "failed"], default: "processing", index: true },
    extractedText: { type: String, default: "", select: false },
    binary: { type: Buffer, select: false },
    errorMessage: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    uploadId: { type: String, default: "", index: true },
    cloudinaryAssetId: { type: String, default: "", index: true },
    cloudinaryPublicId: { type: String, default: "" },
    secureUrl: { type: String, default: "" },
}, { timestamps: true });

KnowledgeSourceSchema.index({ sessionId: 1, name: 1, size: 1 });
KnowledgeSourceSchema.index({ workspaceId: 1, uploadId: 1 }, { unique: true, partialFilterExpression: { uploadId: { $type: "string", $gt: "" } } });
export default model("KnowledgeSource", KnowledgeSourceSchema);
