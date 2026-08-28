import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWidgetConfig extends Document {
    workspaceId: Types.ObjectId;
    name: string;
    status: "active" | "inactive";
    allowedDomains: string[];
    settings: {
        theme: "light" | "dark";
        primary_color: string;
        welcome_message: string;
    };
}

const WidgetConfigSchema = new Schema<IWidgetConfig>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
        name: { type: String, required: true, default: "Default Widget", trim: true },
        status: { type: String, enum: ["active", "inactive"], default: "active" },
        allowedDomains: { type: [String], default: ["example.com", "localhost"] },
        settings: {
            theme: { type: String, enum: ["light", "dark"], default: "light" },
            primary_color: { type: String, default: "#2563eb" },
            welcome_message: { type: String, default: "Hello! How can I help you today?" },
        },
    },
    { timestamps: true },
);

export default mongoose.model<IWidgetConfig>("WidgetConfig", WidgetConfigSchema);
