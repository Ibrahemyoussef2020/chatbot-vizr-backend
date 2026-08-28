import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "super_admin" | "admin" | "agent";

export interface IUser extends Document {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  workspaceId?: Types.ObjectId;
  isActive: boolean;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: false },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["super_admin", "admin", "agent"], default: "admin", index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", index: true },
  isActive: { type: Boolean, default: true, index: true },
});

export default mongoose.model<IUser>("User", UserSchema);
