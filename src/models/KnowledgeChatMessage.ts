import { Schema, model } from "mongoose";

const KnowledgeChatMessageSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "KnowledgeSession", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, trim: true },
    citations: [{ sourceId: String, name: String }],
}, { timestamps: true });

KnowledgeChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
export default model("KnowledgeChatMessage", KnowledgeChatMessageSchema);
