import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

const MessageSchema = new Schema(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true,
        },
        senderType: {
            type: String,
            enum: ["visitor", "assistant"],
            required: true,
        },
        receivedFrom: {
            type: String,
            enum: ["web", "whatsapp", "telegram", "instagram", "gmail"],
            default: "web",
            required: true,
            index: true,
        },
        externalMessageId: {
            type: String,
            trim: true,
            default: () => `internal:${randomUUID()}`,
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000,
        },
        attachments: [
            {
                name: { type: String, required: true },
                url: { type: String, required: true },
                type: { type: String, default: "file" },
                size: { type: Number },
            },
        ],
    },
    { timestamps: true },
);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index(
    { receivedFrom: 1, externalMessageId: 1 },
    { unique: true, sparse: true },
);
export default mongoose.model("Message", MessageSchema);
