import mongoose, { Schema } from "mongoose";

const AIAgentSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    securityRoleId: { type: Schema.Types.ObjectId, ref: "SecurityRole", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    systemPrompt: { type: String, required: true },
    primaryModelId: { type: Schema.Types.ObjectId, ref: "AIModel" },
    fallbackModelIds: [{ type: Schema.Types.ObjectId, ref: "AIModel" }],
    channels: [{ type: String }],
    tools: [{ type: String }],
    temperature: { type: Number, min: 0, max: 2, default: 0.35 },
    maxOutputTokens: { type: Number, min: 1, default: 1200 },
    timeoutMs: { type: Number, min: 1000, default: 45000 },
    enabled: { type: Boolean, default: true, index: true },
}, { timestamps: true });
AIAgentSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });
export default mongoose.model("AIAgent", AIAgentSchema);
