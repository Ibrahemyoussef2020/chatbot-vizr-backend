import mongoose, { Schema } from "mongoose";

const LandingPageSchema = new Schema({
    slug: { type: String, required: true, unique: true, index: true },
    contentVersion: { type: Number, required: true, default: 1 },
    title: { type: String, required: true },
    eyebrow: String,
    description: String,
    sections: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, minimize: false });

export default mongoose.model("LandingPage", LandingPageSchema);
