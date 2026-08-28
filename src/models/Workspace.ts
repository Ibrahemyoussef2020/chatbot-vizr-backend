import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWorkspace extends Document {
    name: string;
    slug: string;
    ownerId: Types.ObjectId;
    isActive: boolean;
    rateLimit: number;
    webhookUrl?: string;
}

const WorkspaceSchema = new Schema<IWorkspace>(
    {
        name: { type: String, required: true, trim: true, maxlength: 255 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        isActive: { type: Boolean, default: true, index: true },
        rateLimit: { type: Number, default: 60, min: 1, max: 1000 },
        webhookUrl: { type: String, default: "" },
    },
    { timestamps: true },
);

export default mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);
