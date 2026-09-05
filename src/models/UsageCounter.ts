import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUsageCounter extends Document {
    workspaceId: Types.ObjectId;
    metric: string;
    windowKey: string;
    count: number;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UsageCounterSchema = new Schema<IUsageCounter>(
    {
        workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
        metric: { type: String, required: true, trim: true },
        windowKey: { type: String, required: true, trim: true },
        count: { type: Number, default: 0, min: 0 },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true },
);

UsageCounterSchema.index({ workspaceId: 1, metric: 1, windowKey: 1 }, { unique: true });
UsageCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IUsageCounter>("UsageCounter", UsageCounterSchema);
