import mongoose, { Schema } from "mongoose";

const SystemLogSchema = new Schema(
    {
        publicId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        systemSlug: {
            type: String,
            default: "demo",
            index: true,
        },
        level: {
            type: String,
            enum: ["info", "warn", "error"],
            default: "info",
            index: true,
        },
        category: {
            type: String,
            default: "system",
        },
        message: {
            type: String,
            required: true,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true },
);

SystemLogSchema.index({ systemSlug: 1, createdAt: -1 });

export default mongoose.model("SystemLog", SystemLogSchema);
