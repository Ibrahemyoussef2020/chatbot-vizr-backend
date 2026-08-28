import mongoose, { Schema } from "mongoose";

const TagSchema = new Schema(
    {
        publicId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        systemSlug: {
            type: String,
            default: "brand-ecommerce",
            index: true,
        },
        label: {
            type: String,
            required: true,
            trim: true,
        },
        name: {
            type: String,
            trim: true,
        },
        bg: {
            type: String,
            default: "#e0f2fe",
        },
        color: {
            type: String,
            default: "#0369a1",
        },
        description: {
            type: String,
            default: "",
        },
        usageCount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true },
);

TagSchema.pre("save", function () {
    if (this.label && !this.name) {
        this.name = this.label;
    } else if (this.name && !this.label) {
        this.label = this.name;
    }
});

TagSchema.index({ systemSlug: 1, label: 1 });

export default mongoose.model("Tag", TagSchema);
