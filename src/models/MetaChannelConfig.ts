import { Schema, model } from "mongoose";

const MetaChannelConfigSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    instagramAccountId: { type: String, required: true, unique: true, trim: true, index: true },
    pageId: { type: String, required: true, trim: true },
    pageAccessToken: { type: String, required: true, select: false },
    appSecret: { type: String, required: true, select: false },
    verifyToken: { type: String, required: true, select: false },
    status: { type: String, enum: ["active", "disabled", "error"], default: "active", index: true },
    lastError: { type: String, default: "" },
}, { timestamps: true });

export default model("MetaChannelConfig", MetaChannelConfigSchema);
