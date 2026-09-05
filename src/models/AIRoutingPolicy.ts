import mongoose, { Schema } from "mongoose";
const schema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true }, strategy: { type: String, enum: ["priority", "round_robin", "least_used", "lowest_latency", "quota_aware"], default: "quota_aware" },
    enabled: { type: Boolean, default: true }, agentId: { type: Schema.Types.ObjectId, ref: "AIAgent", index: true },
    modelIds: [{ type: Schema.Types.ObjectId, ref: "AIModel" }], maxRetries: { type: Number, default: 2 }, timeoutMs: { type: Number, default: 45000 },
}, { timestamps: true });
schema.index({ workspaceId: 1, name: 1 }, { unique: true });
export default mongoose.model("AIRoutingPolicy", schema);
