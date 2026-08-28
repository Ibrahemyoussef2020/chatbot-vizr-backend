import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISecurityRole extends Document {
    name: string;
    workspaceId?: Types.ObjectId | null;
    permissions: string[];
    users_count: number;
}

const SecurityRoleSchema = new Schema<ISecurityRole>(
    {
        name: { type: String, required: true, trim: true },
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
        permissions: { type: [String], default: [] },
        users_count: { type: Number, default: 0 },
    },
    { timestamps: true },
);

export default mongoose.model<ISecurityRole>("SecurityRole", SecurityRoleSchema);
