import { Schema, model } from "mongoose";

const NoteSchema = new Schema({
    title: { type: String, required: true, maxlength: 240 },
    description: { type: String, default: "", maxlength: 10000 },
    meta: { type: String, maxlength: 500 },
    status: { type: String, maxlength: 80 },
}, { _id: false });

const ChartItemSchema = new Schema({
    label: { type: String, required: true, maxlength: 240 },
    value: { type: Number, required: true },
    detail: { type: String, maxlength: 500 },
    tone: { type: String, enum: ["primary", "success", "warning", "danger"] },
}, { _id: false });

const ChartSchema = new Schema({
    title: { type: String, required: true, maxlength: 240 },
    description: { type: String, maxlength: 1000 },
    kind: { type: String, enum: ["bars", "progress", "donut", "timeline"], required: true },
    items: { type: [ChartItemSchema], default: [] },
}, { _id: false });

const KnowledgeOutputSectionSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "KnowledgeSession", required: true, index: true },
    outputId: { type: Schema.Types.ObjectId, ref: "KnowledgeOutput", required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 100 },
    order: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: "", maxlength: 20000 },
    notes: { type: [NoteSchema], default: [] },
    charts: { type: [ChartSchema], default: [] },
    status: { type: String, enum: ["pending", "generating", "ready", "failed"], default: "ready", index: true },
    error: { type: String, default: "", maxlength: 2000 },
    generationAttempt: { type: Number, default: 0 },
}, { timestamps: true });

KnowledgeOutputSectionSchema.index({ outputId: 1, key: 1 }, { unique: true });
KnowledgeOutputSectionSchema.index({ outputId: 1, order: 1 });

export default model("KnowledgeOutputSection", KnowledgeOutputSectionSchema);
