import { Schema, model } from "mongoose";

const WebhookEventSchema = new Schema({
    channel: { type: String, enum: ["whatsapp", "telegram", "instagram"], required: true },
    externalEventId: { type: String, required: true },
    systemSlug: { type: String, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    jobId: { type: String, default: "" },
    status: { type: String, enum: ["received", "queued", "processing", "completed", "retrying", "failed"], default: "received", index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "", maxlength: 2000 },
    payload: { type: Schema.Types.Mixed, required: true },
    completedAt: Date,
}, { timestamps: true });

WebhookEventSchema.index({ channel: 1, externalEventId: 1 }, { unique: true });

export default model("WebhookEvent", WebhookEventSchema);
