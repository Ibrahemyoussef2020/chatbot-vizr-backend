import mongoose, { Document, Schema, Types } from "mongoose";
import type { BillingCycle } from "./Subscription.js";

export type TransactionStatus =
    | "pending"
    | "awaiting_review"
    | "succeeded"
    | "failed"
    | "refunded"
    | "cancelled";

export const TERMINAL_TRANSACTION_STATUSES: TransactionStatus[] = ["succeeded", "failed", "refunded", "cancelled"];

export interface IPaymentTransaction extends Document {
    reference: string;
    workspaceId?: Types.ObjectId;
    userId?: Types.ObjectId;
    planId: Types.ObjectId;
    planCode: string;
    provider: string;
    billingCycle: BillingCycle;
    amount: number;
    currency: string;
    status: TransactionStatus;
    providerRef?: string;
    payerFields: Map<string, string>;
    payerEmail?: string;
    payerName?: string;
    proofUrl?: string;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    reviewNote?: string;
    failureReason?: string;
    rawEvent?: unknown;
    createdAt: Date;
    updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
    {
        reference: { type: String, required: true, unique: true, trim: true, index: true },
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
        planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
        planCode: { type: String, required: true, trim: true, lowercase: true },
        provider: { type: String, required: true, trim: true, lowercase: true, index: true },
        billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: "USD", uppercase: true, trim: true },
        status: {
            type: String,
            enum: ["pending", "awaiting_review", "succeeded", "failed", "refunded", "cancelled"],
            default: "pending",
            index: true,
        },
        providerRef: { type: String, default: null, trim: true, index: { unique: true, sparse: true } },
        payerFields: { type: Map, of: String, default: () => new Map<string, string>() },
        payerEmail: { type: String, default: "", trim: true, lowercase: true },
        payerName: { type: String, default: "", trim: true },
        proofUrl: { type: String, default: "", trim: true },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        reviewNote: { type: String, default: "", trim: true, maxlength: 1000 },
        failureReason: { type: String, default: "", trim: true, maxlength: 1000 },
        rawEvent: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true, minimize: false },
);

PaymentTransactionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IPaymentTransaction>("PaymentTransaction", PaymentTransactionSchema);
