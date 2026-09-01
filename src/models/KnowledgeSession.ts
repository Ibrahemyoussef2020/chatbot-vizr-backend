import { Schema, model } from "mongoose";

const KnowledgeSessionSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: ["empty", "processing", "ready", "partial", "failed"], default: "empty", index: true },
    sourceCount: { type: Number, default: 0 },
    readySourceCount: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
}, { timestamps: true });

export default model("KnowledgeSession", KnowledgeSessionSchema);
