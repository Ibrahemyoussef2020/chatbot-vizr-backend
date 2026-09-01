import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISecurityRole extends Document {
    name: string;
    code: string;
    description?: string;
    scope: "business" | "workspace";
    isSystem: boolean;
    workspaceId?: Types.ObjectId | null;
    permissions: string[];
    users_count: number;
}

const SecurityRoleSchema = new Schema<ISecurityRole>(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, lowercase: true },
        description: { type: String, default: "", trim: true },
        scope: { type: String, enum: ["business", "workspace"], default: "workspace", index: true },
        isSystem: { type: Boolean, default: false },
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
        permissions: { type: [String], default: [] },
        users_count: { type: Number, default: 0 },
    },
    { timestamps: true },
);

SecurityRoleSchema.index(
    { workspaceId: 1, code: 1 },
    { unique: true, partialFilterExpression: { code: { $type: "string" } } },
);

export default mongoose.model<ISecurityRole>("SecurityRole", SecurityRoleSchema);
