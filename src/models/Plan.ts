import mongoose, { Document, Schema } from "mongoose";

export type PlanStatus = "draft" | "published" | "archived";
export type PlanVisibility = "public" | "private";
export type OveragePolicy = "block" | "throttle" | "allow";

export interface IPlan extends Document {
    code: string;
    name: string;
    description: string;
    eyebrow?: string;
    status: PlanStatus;
    visibility: PlanVisibility;
    sortOrder: number;
    popular: boolean;
    currency: string;
    pricing: {
        monthly: number | null;
        yearly: number | null;
    };
    trialDays: number;
    ctaLabel?: string;
    ctaPath?: string;
    features: string[];
    quotas: Map<string, number>;
    entitlements: Map<string, boolean>;
    overagePolicy: OveragePolicy;
    allowedProviders: string[];
    createdAt: Date;
    updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
    {
        code: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, default: "", trim: true, maxlength: 1000 },
        eyebrow: { type: String, default: "", trim: true, maxlength: 120 },
        status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
        visibility: { type: String, enum: ["public", "private"], default: "public", index: true },
        sortOrder: { type: Number, default: 0 },
        popular: { type: Boolean, default: false },
        currency: { type: String, default: "USD", uppercase: true, trim: true },
        pricing: {
            monthly: { type: Number, default: null, min: 0 },
            yearly: { type: Number, default: null, min: 0 },
        },
        trialDays: { type: Number, default: 0, min: 0, max: 365 },
        ctaLabel: { type: String, default: "", trim: true, maxlength: 120 },
        ctaPath: { type: String, default: "", trim: true, maxlength: 255 },
        features: { type: [String], default: [] },
        quotas: { type: Map, of: Number, default: () => new Map<string, number>() },
        entitlements: { type: Map, of: Boolean, default: () => new Map<string, boolean>() },
        overagePolicy: { type: String, enum: ["block", "throttle", "allow"], default: "block" },
        allowedProviders: { type: [String], default: [] },
    },
    { timestamps: true },
);

PlanSchema.index({ status: 1, visibility: 1, sortOrder: 1 });

export default mongoose.model<IPlan>("Plan", PlanSchema);
