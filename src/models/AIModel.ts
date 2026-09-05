import mongoose, { Schema } from "mongoose";

const AIModelSchema = new Schema({
    providerId: { type: Schema.Types.ObjectId, ref: "AIProvider", required: true, index: true },
    externalId: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    alias: { type: String, trim: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100 },
    contextWindow: { type: Number },
    maxOutputTokens: { type: Number },
    capabilities: {
        text: { type: Boolean, default: true }, vision: { type: Boolean, default: false },
        tools: { type: Boolean, default: false }, streaming: { type: Boolean, default: true },
        reasoning: { type: Boolean, default: false },
    },
}, { timestamps: true });
AIModelSchema.index({ providerId: 1, externalId: 1 }, { unique: true });
export default mongoose.model("AIModel", AIModelSchema);
