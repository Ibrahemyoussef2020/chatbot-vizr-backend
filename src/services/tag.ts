import { randomUUID } from "node:crypto";
import Tag from "../models/Tag.js";
import { notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";

export interface CreateTagInput {
    systemSlug?: string;
    label?: string;
    name?: string;
    bg?: string;
    color?: string;
    description?: string;
}

export interface UpdateTagInput {
    label?: string;
    name?: string;
    bg?: string;
    color?: string;
    description?: string;
}

export const listTags = async (systemSlug?: string) => {
    const query = systemSlug && systemSlug !== "all" ? { systemSlug } : {};
    const tags = await Tag.find(query).sort({ createdAt: -1 }).lean().exec();

    return tags.map((tag) => {
        const tagLabel = tag.label || tag.name || "Untitled Tag";
        return {
            id: tag.publicId,
            label: tagLabel,
            name: tagLabel,
            bg: tag.bg || "#e0f2fe",
            color: tag.color || "#0369a1",
            description: tag.description || "",
            usageCount: tag.usageCount || 0,
            systemSlug: tag.systemSlug || "brand-ecommerce",
            createdAt: tag.createdAt,
        };
    });
};

export const createTag = async (input: CreateTagInput) => {
    const tagLabel = (input.label || input.name)?.trim();
    if (!tagLabel) throw unprocessableEntityError("Tag label is required");

    const tag = await Tag.create({
        publicId: randomUUID(),
        systemSlug: input.systemSlug || "brand-ecommerce",
        label: tagLabel,
        name: tagLabel,
        bg: input.bg || "#e0f2fe",
        color: input.color || "#0369a1",
        description: input.description?.trim() || "",
    });

    return {
        id: tag.publicId,
        label: tag.label || tag.name,
        name: tag.name || tag.label,
        bg: tag.bg,
        color: tag.color,
        description: tag.description,
        usageCount: tag.usageCount,
        systemSlug: tag.systemSlug,
        createdAt: tag.createdAt,
    };
};

export const updateTag = async (publicId: string, input: UpdateTagInput) => {
    const tag = await Tag.findOne({ publicId }).exec();
    if (!tag) throw notFoundError("Tag not found");

    const updatedLabel = (input.label || input.name)?.trim();
    if (updatedLabel) {
        tag.label = updatedLabel;
        tag.name = updatedLabel;
    }

    if (input.bg !== undefined) tag.bg = input.bg;
    if (input.color !== undefined) tag.color = input.color;
    if (input.description !== undefined) tag.description = input.description.trim();

    await tag.save();

    return {
        id: tag.publicId,
        label: tag.label || tag.name,
        name: tag.name || tag.label,
        bg: tag.bg,
        color: tag.color,
        description: tag.description,
        usageCount: tag.usageCount,
        systemSlug: tag.systemSlug,
        createdAt: tag.createdAt,
    };
};

export const deleteTag = async (publicId: string) => {
    const tag = await Tag.findOneAndDelete({ publicId }).exec();
    if (!tag) throw notFoundError("Tag not found");

    return { success: true, id: publicId };
};
