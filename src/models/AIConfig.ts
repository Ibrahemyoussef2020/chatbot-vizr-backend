import mongoose, { Document, Schema, Types } from "mongoose";

export interface IActionData {
    action: string;
    link: string;
    description: string;
}

export interface IUploadedFile {
    name: string;
    url: string;
    size: number;
}

export interface IAIConfig extends Document {
    workspaceId: Types.ObjectId;
    company_name: string;
    assistant_name: string;
    contact_email: string;
    website_url: string;
    contact_us_link: string;
    company_description: string;
    tone_instructions: string;
    pricing_instructions: string;
    language_notes: string;
    contact_collection_rules: string;
    actions_data: IActionData[];
    uploaded_files: IUploadedFile[];
}

const AIConfigSchema = new Schema<IAIConfig>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
        company_name: { type: String, default: "My Company LLC", trim: true },
        assistant_name: { type: String, default: "AI Assistant", trim: true },
        contact_email: { type: String, default: "support@company.com", trim: true },
        website_url: { type: String, default: "https://company.com", trim: true },
        contact_us_link: { type: String, default: "https://company.com/contact", trim: true },
        company_description: { type: String, default: "We provide innovative AI & digital solutions." },
        tone_instructions: { type: String, default: "Be professional, helpful, empathetic, and concise." },
        pricing_instructions: { type: String, default: "Provide standard tier details and offer custom enterprise quotes." },
        language_notes: { type: String, default: "Support English, Arabic, and French fluently." },
        contact_collection_rules: { type: String, default: "Politely collect full name, email, phone number, and primary request." },
        actions_data: [
            {
                action: { type: String, default: "" },
                link: { type: String, default: "" },
                description: { type: String, default: "" },
            },
        ],
        uploaded_files: [
            {
                name: { type: String, default: "" },
                url: { type: String, default: "" },
                size: { type: Number, default: 0 },
            },
        ],
    },
    { timestamps: true },
);

export default mongoose.model<IAIConfig>("AIConfig", AIConfigSchema);
