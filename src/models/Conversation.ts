import mongoose, { Schema } from "mongoose";

const ConversationSchema = new Schema(
    {
        publicId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        sessionTokenHash: {
            type: String,
            required: true,
            select: false,
        },
        systemSlug: {
            type: String,
            required: true,
            default: "brand-ecommerce",
            index: true,
        },
        visitor: {
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100,
            },
            email: {
                type: String,
                trim: true,
                lowercase: true,
                maxlength: 254,
            },
            phone: {
                type: String,
                trim: true,
                maxlength: 30,
            },
        },
        priority: {
            type: String,
            enum: ["high", "medium", "low"],
            default: "medium",
            index: true,
        },
        assignedAgent: {
            id: { type: String, trim: true },
            name: { type: String, trim: true },
            email: { type: String, trim: true },
        },
        tags: [{ type: String, trim: true }],
        notes: [
            {
                id: { type: String, required: true },
                content: { type: String, required: true },
                author: { type: String, default: "Support Agent" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        status: {
            type: String,
            enum: ["active", "ended"],
            default: "active",
            index: true,
        },
        endedAt: Date,
    },
    { timestamps: true },
);

export default mongoose.model("Conversation", ConversationSchema);
