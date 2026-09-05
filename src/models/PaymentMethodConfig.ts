import mongoose, { Document, Schema } from "mongoose";

export type PayerFieldType = "text" | "number" | "tel" | "email" | "file" | "select" | "date";

export interface IPayerField {
    key: string;
    label: string;
    type: PayerFieldType;
    options: string[];
    required: boolean;
    placeholder?: string;
    pattern?: string;
    helpText?: string;
    order: number;
}

export interface IPaymentMethodConfig extends Document {
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
    createdAt: Date;
    updatedAt: Date;
}

const PayerFieldSchema = new Schema<IPayerField>(
    {
        key: { type: String, required: true, trim: true, maxlength: 60 },
        label: { type: String, required: true, trim: true, maxlength: 120 },
        type: {
            type: String,
            enum: ["text", "number", "tel", "email", "file", "select", "date"],
            default: "text",
        },
        options: { type: [String], default: [] },
        required: { type: Boolean, default: true },
        placeholder: { type: String, default: "", trim: true, maxlength: 160 },
        pattern: { type: String, default: "", trim: true, maxlength: 255 },
        helpText: { type: String, default: "", trim: true, maxlength: 255 },
        order: { type: Number, default: 0 },
    },
    { _id: false },
);

const PaymentMethodConfigSchema = new Schema<IPaymentMethodConfig>(
    {
        provider: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
        label: { type: String, required: true, trim: true, maxlength: 120 },
        isEnabled: { type: Boolean, default: false, index: true },
        isTestMode: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 },
        credentials: { type: Map, of: String, default: () => new Map<string, string>() },
        settings: { type: Map, of: Schema.Types.Mixed, default: () => new Map<string, unknown>() },
        payerFields: { type: [PayerFieldSchema], default: [] },
        supportedCurrencies: { type: [String], default: ["USD"] },
        instructions: { type: String, default: "", trim: true, maxlength: 2000 },
    },
    { timestamps: true, minimize: false },
);

export default mongoose.model<IPaymentMethodConfig>("PaymentMethodConfig", PaymentMethodConfigSchema);
