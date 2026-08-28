import mongoose, { Schema } from "mongoose";

const TokenLogSchema = new Schema(
    {
        publicId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        systemSlug: {
            type: String,
            default: "brand-ecommerce",
            index: true,
        },
        apiKeyId: {
            type: String,
            required: true,
            default: "key_openai_prod_01",
            index: true,
        },
        threadId: {
            type: String,
            required: true,
            default: "conv-brand-001",
            index: true,
        },
        sourceType: {
            type: String,
            enum: ["external_api", "internal_agent"],
            default: "external_api",
            index: true,
        },
        agentName: {
            type: String,
            default: "Public Chatbot API",
            index: true,
        },
        model: {
            type: String,
            required: true,
        },
        provider: {
            type: String,
            required: true,
        },
        promptTokens: {
            type: Number,
            required: true,
            default: 0,
        },
        completionTokens: {
            type: Number,
            required: true,
            default: 0,
        },
        totalTokens: {
            type: Number,
            required: true,
            default: 0,
        },
        durationMs: {
            type: Number,
            required: true,
            default: 0,
        },
        costUSD: {
            type: Number,
            required: true,
            default: 0,
        },
        status: {
            type: String,
            enum: ["success", "fallback", "failed"],
            default: "success",
        },
    },
    { timestamps: true },
);

TokenLogSchema.index({ systemSlug: 1, sourceType: 1, createdAt: -1 });
TokenLogSchema.index({ systemSlug: 1, apiKeyId: 1, createdAt: -1 });
TokenLogSchema.index({ systemSlug: 1, threadId: 1, createdAt: -1 });

export default mongoose.model("TokenLog", TokenLogSchema);
