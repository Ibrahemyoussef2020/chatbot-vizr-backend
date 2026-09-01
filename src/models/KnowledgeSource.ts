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
}, { timestamps: true });

KnowledgeSourceSchema.index({ sessionId: 1, name: 1, size: 1 });
export default model("KnowledgeSource", KnowledgeSourceSchema);
