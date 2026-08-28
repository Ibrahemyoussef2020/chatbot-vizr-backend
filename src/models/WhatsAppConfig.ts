import mongoose, { Schema, Document } from "mongoose";

export interface IWhatsAppConfig extends Document {
    workspaceId: mongoose.Types.ObjectId;
    provider: "meta" | "openwa";
    ai_engine_type: "internal_server" | "openai_api";
    internal_server_url?: string;
    openai_api_key?: string;
    whatsapp_app_secret?: string;
    whatsapp_phone_number_id?: string;
    whatsapp_verify_token?: string;
    whatsapp_waba_id?: string;
    whatsapp_access_token?: string;
    openwa_api_url?: string;
    openwa_api_key?: string;
    openwa_session_id?: string;
    sessions: Array<{
        session_id: string;
        status: "connected" | "qr_ready" | "failed" | "disconnected";
        phone?: string;
    }>;
    qr_code_url?: string;
    createdAt: Date;
    updatedAt: Date;
}

const WhatsAppConfigSchema = new Schema<IWhatsAppConfig>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true },
        provider: { type: String, enum: ["meta", "openwa"], default: "meta" },
        ai_engine_type: { type: String, enum: ["internal_server", "openai_api"], default: "openai_api" },
        internal_server_url: { type: String, default: "http://localhost:11434/v1" },
        openai_api_key: { type: String, default: "" },
        whatsapp_app_secret: { type: String, default: "" },
        whatsapp_phone_number_id: { type: String, default: "" },
        whatsapp_verify_token: { type: String, default: "" },
        whatsapp_waba_id: { type: String, default: "" },
        whatsapp_access_token: { type: String, default: "" },
        openwa_api_url: { type: String, default: "http://localhost:8080" },
        openwa_api_key: { type: String, default: "" },
        openwa_session_id: { type: String, default: "main_session" },
        sessions: [
            {
                session_id: { type: String, required: true },
                status: { type: String, default: "connected" },
                phone: { type: String, default: "" },
            },
        ],
        qr_code_url: { type: String, default: "" },
    },
    { timestamps: true },
);

export default mongoose.model<IWhatsAppConfig>("WhatsAppConfig", WhatsAppConfigSchema);
