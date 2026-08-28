import mongoose, { Schema } from "mongoose";
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
export default mongoose.model("Message", MessageSchema);
