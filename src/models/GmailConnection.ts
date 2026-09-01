import mongoose, { Document, Schema } from "mongoose";

export interface IGmailConnection extends Document {
    workspaceId: mongoose.Types.ObjectId;
    email: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    historyId?: string;
    watchExpiration?: Date;
    status: "active" | "error" | "pending";
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const GmailConnectionSchema = new Schema<IGmailConnection>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true, index: true },
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        accessToken: { type: String, default: "", select: false },
        refreshToken: { type: String, default: "", select: false },
        tokenExpiresAt: Date,
        historyId: { type: String, default: "" },
        watchExpiration: Date,
        status: { type: String, enum: ["active", "error", "pending"], default: "pending" },
        errorMessage: { type: String, default: "" },
    },
    { timestamps: true },
);

export default mongoose.model<IGmailConnection>("GmailConnection", GmailConnectionSchema);
