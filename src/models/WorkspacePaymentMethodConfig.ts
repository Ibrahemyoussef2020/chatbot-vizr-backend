import mongoose, { Schema, Types } from "mongoose";
import type { IPayerField } from "./PaymentMethodConfig.js";

export interface IWorkspacePaymentMethodConfig extends mongoose.Document {
    workspaceId: Types.ObjectId;
    provider: string;
    label: string;
    isEnabled: boolean;
    isTestMode: boolean;
    sortOrder: number;
    credentials: Map<string, string>;
    settings: Map<string, unknown>;
    payerFields: IPayerField[];
    supportedCurrencies: string[];
    instructions: string;
}

const payerFieldSchema = new Schema<IPayerField>({
    key: String,
    label: String,
    type: String,
    options: { type: [String], default: [] },
    required: Boolean,
    placeholder: String,
    pattern: String,
    helpText: String,
    order: Number,
}, { _id: false });

const schema = new Schema<IWorkspacePaymentMethodConfig>({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    provider: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    isEnabled: { type: Boolean, default: false, index: true },
    isTestMode: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    credentials: { type: Map, of: String, default: () => new Map<string, string>(), select: false },
    settings: { type: Map, of: Schema.Types.Mixed, default: () => new Map<string, unknown>() },
    payerFields: { type: [payerFieldSchema], default: [] },
    supportedCurrencies: { type: [String], default: ["USD"] },
    instructions: { type: String, default: "", trim: true, maxlength: 2000 },
}, { timestamps: true, minimize: false });

schema.index({ workspaceId: 1, provider: 1 }, { unique: true });

export default mongoose.model<IWorkspacePaymentMethodConfig>("WorkspacePaymentMethodConfig", schema);
