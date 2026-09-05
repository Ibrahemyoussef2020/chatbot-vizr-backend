import mongoose, { Schema } from "mongoose";
const schema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true }, scope: { type: String, enum: ["workspace", "agent", "provider", "model"], required: true },
    scopeId: { type: Schema.Types.ObjectId }, period: { type: String, enum: ["minute", "day", "month"], required: true },
    requestLimit: { type: Number, default: 0 }, tokenLimit: { type: Number, default: 0 }, concurrencyLimit: { type: Number, default: 1 },
    usedRequests: { type: Number, default: 0 }, usedTokens: { type: Number, default: 0 }, enabled: { type: Boolean, default: true }, resetAt: { type: Date },
}, { timestamps: true });
schema.index({ workspaceId: 1, name: 1 }, { unique: true });
export default mongoose.model("AIQuotaPolicy", schema);
