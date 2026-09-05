import mongoose, { Document, Schema, Types } from "mongoose";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";
export type BillingCycle = "monthly" | "yearly";

export interface ISubscription extends Document {
    workspaceId: Types.ObjectId;
    planId: Types.ObjectId;
    planCode: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    provider: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date;
    quotaOverrides: Map<string, number>;
    createdAt: Date;
    updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
        planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
        planCode: { type: String, required: true, trim: true, lowercase: true },
        status: {
            type: String,
            enum: ["trialing", "active", "past_due", "canceled", "expired"],
            default: "active",
            index: true,
        },
        billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
        currentPeriodStart: { type: Date, required: true, default: Date.now },
        currentPeriodEnd: { type: Date, required: true, index: true },
        provider: { type: String, required: true, trim: true, lowercase: true },
        providerCustomerId: { type: String, default: "", trim: true },
        providerSubscriptionId: { type: String, default: "", trim: true },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        canceledAt: { type: Date, default: null },
        quotaOverrides: { type: Map, of: Number, default: () => new Map<string, number>() },
    },
    { timestamps: true },
);

// A workspace may only hold one live subscription at a time.
SubscriptionSchema.index(
    { workspaceId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ["trialing", "active", "past_due"] } } },
);

export default mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
