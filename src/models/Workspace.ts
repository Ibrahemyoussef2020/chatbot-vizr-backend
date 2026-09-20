import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWorkspace extends Document {
    name: string;
    slug: string;
    businessName: string;
    industry: string;
    websiteUrl: string;
    supportEmail: string;
    supportPhone: string;
    country: string;
    timezone: string;
    currency: string;
    selectedPlanCode: string;
    ownerId: Types.ObjectId;
    isActive: boolean;
    rateLimit: number;
    webhookUrl?: string;
    defaultAiAgentId?: Types.ObjectId | null;
    disabledChannelDefaults?: string[];
}

const WorkspaceSchema = new Schema<IWorkspace>(
    {
        name: { type: String, required: true, trim: true, maxlength: 255 },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        businessName: { type: String, default: "", trim: true, maxlength: 255 },
        industry: { type: String, default: "", trim: true, maxlength: 120 },
        websiteUrl: { type: String, default: "", trim: true, maxlength: 500 },
        supportEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
        supportPhone: { type: String, default: "", trim: true, maxlength: 40 },
        country: { type: String, default: "", trim: true, maxlength: 120 },
        timezone: { type: String, default: "UTC", trim: true, maxlength: 100 },
        currency: { type: String, default: "USD", trim: true, uppercase: true, minlength: 3, maxlength: 3 },
        selectedPlanCode: { type: String, default: "", trim: true, lowercase: true, maxlength: 120 },
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        isActive: { type: Boolean, default: true, index: true },
        rateLimit: { type: Number, default: 60, min: 1, max: 1000 },
        webhookUrl: { type: String, default: "" },
        defaultAiAgentId: { type: Schema.Types.ObjectId, ref: "AIAgent", default: null },
        disabledChannelDefaults: { type: [String], default: [] },
    },
    { timestamps: true },
);

export default mongoose.model<IWorkspace>("Workspace", WorkspaceSchema);
