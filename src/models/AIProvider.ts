import mongoose, { Schema } from "mongoose";

export const AI_PROVIDER_CODES = ["google", "openrouter", "cohere", "mistral", "nvidia", "cloudflare", "sambanova", "ollama", "orcarouter"] as const;

const AIProviderSchema = new Schema({
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    keyEnvName: { type: String, required: true },
    accountEnvName: { type: String },
    baseUrl: { type: String },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100 },
    health: { type: String, enum: ["unknown", "healthy", "degraded", "down"], default: "unknown" },
    lastCheckedAt: { type: Date },
    lastError: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("AIProvider", AIProviderSchema);
