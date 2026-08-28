import mongoose, { Schema, Document } from "mongoose";

export interface ITelegramBot extends Document {
    workspaceId: mongoose.Types.ObjectId;
    bot_token: string;
    bot_name: string;
    bot_username: string;
    ai_engine_type: "internal_server" | "openai_api";
    internal_server_url?: string;
    openai_api_key?: string;
    status: "active" | "error" | "pending";
    last_activity_at?: Date;
    error_message?: string;
    createdAt: Date;
    updatedAt: Date;
}

const TelegramBotSchema = new Schema<ITelegramBot>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
        bot_token: { type: String, required: true },
        bot_name: { type: String, default: "Telegram Bot" },
        bot_username: { type: String, default: "vizr_chatbot_bot" },
        ai_engine_type: { type: String, enum: ["internal_server", "openai_api"], default: "openai_api" },
        internal_server_url: { type: String, default: "http://localhost:11434/v1" },
        openai_api_key: { type: String, default: "" },
        status: { type: String, enum: ["active", "error", "pending"], default: "active" },
        last_activity_at: { type: Date, default: Date.now },
        error_message: { type: String, default: "" },
    },
    { timestamps: true },
);

export default mongoose.model<ITelegramBot>("TelegramBot", TelegramBotSchema);
