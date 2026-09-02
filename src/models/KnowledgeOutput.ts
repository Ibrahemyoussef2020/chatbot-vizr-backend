import { Schema, model } from "mongoose";

const KnowledgeOutputSchema = new Schema({
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "KnowledgeSession", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["plan", "report"], required: true },
    seedKey: { type: String, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, default: "", maxlength: 4000 },
    category: { type: String, default: "", maxlength: 120 },
    status: { type: String, enum: ["draft", "generating", "partial", "ready", "failed"], default: "draft", index: true },
    isSaved: { type: Boolean, default: false, index: true },
    shareToken: { type: String, unique: true, sparse: true, index: true },
    sharedAt: { type: Date },
    version: { type: Number, default: 1 },
}, { timestamps: true });

KnowledgeOutputSchema.index(
    { workspaceId: 1, sessionId: 1, kind: 1, seedKey: 1 },
    { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
);

export default model("KnowledgeOutput", KnowledgeOutputSchema);
