import mongoose, { Schema } from "mongoose";

const AIRequestLogSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "AIAgent", index: true },
    provider: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    requestType: { type: String, enum: ["generate", "stream"], required: true },
    promptTokens: { type: Number, default: 0 }, completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }, latencyMs: { type: Number, default: 0 },
    status: { type: String, enum: ["success", "fallback", "failed"], required: true, index: true },
    statusCode: { type: Number }, errorCode: { type: String }, errorMessage: { type: String },
    fallbackAttempts: { type: Number, default: 0 }, estimatedCostUsd: { type: Number, default: 0 },
    correlationId: { type: String, required: true, unique: true },
}, { timestamps: true });
AIRequestLogSchema.index({ workspaceId: 1, createdAt: -1 });
export default mongoose.model("AIRequestLog", AIRequestLogSchema);
