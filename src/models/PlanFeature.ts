import mongoose, { Schema } from "mongoose";

const schema = new Schema({
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    // Registry keys contain dots, which Mongoose Map keys cannot contain.
    // The service validates every metric key and numeric limit before saving.
    quotas: { type: Schema.Types.Mixed, default: () => ({}) },
    agentSlugs: { type: [String], default: [] },
}, { timestamps: true });

export default mongoose.model("PlanFeature", schema);
