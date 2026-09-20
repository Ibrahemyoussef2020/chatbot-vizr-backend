import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { forbiddenError, notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import User, { type UserRole } from "../../models/User.js";
import Workspace from "../../models/Workspace.js";
import { ensureWorkspaceChannelDefaults } from "../integrations/channelDefaults.js";

export interface AuthenticatedUserContext {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    workspaceId?: string;
    securityRoleId?: string;
    permissions?: string[];
}

const slugify = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const uniqueSlug = async (name: string) => {
    const base = slugify(name) || "workspace";
    const exists = await Workspace.exists({ slug: base });

    return exists ? `${base}-${randomBytes(3).toString("hex")}` : base;
};

export const createInitialWorkspace = async (userId: Types.ObjectId, userName: string) => {
    const workspace = await Workspace.create({
        name: `${userName}'s Workspace`,
        slug: await uniqueSlug(`${userName}-workspace`),
        ownerId: userId,
    });

    await User.findByIdAndUpdate(userId, {
        role: "admin",
        workspaceId: workspace._id,
    });
    await ensureWorkspaceChannelDefaults(workspace._id);

    return workspace;
};

export const ensureUserWorkspace = async (user: {
    _id: Types.ObjectId;
    name: string;
    role: UserRole;
    workspaceId?: Types.ObjectId;
}) => {
    if (user.role === "super_admin" || user.workspaceId) return user.workspaceId;

    const existing = await Workspace.findOne({ ownerId: user._id }).exec();
    if (existing) {
        await User.findByIdAndUpdate(user._id, { workspaceId: existing._id });
        return existing._id;
    }

    const workspace = await createInitialWorkspace(user._id, user.name);
    return workspace._id;
};

const scope = (user: AuthenticatedUserContext) => {
    if (user.role === "super_admin") return {};
    if (!user.workspaceId) throw forbiddenError("No workspace is assigned to this account");

    return { _id: user.workspaceId };
};

const serialize = (workspace: {
    _id: unknown;
    name: string;
    slug: string;
    businessName?: string;
    industry?: string;
    websiteUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
    country?: string;
    timezone?: string;
    currency?: string;
    selectedPlanCode?: string;
    isActive: boolean;
    rateLimit: number;
    createdAt?: Date;
    updatedAt?: Date;
}) => ({
    id: workspace._id,
    name: workspace.name,
    slug: workspace.slug,
    business_name: workspace.businessName || "",
    industry: workspace.industry || "",
    website_url: workspace.websiteUrl || "",
    support_email: workspace.supportEmail || "",
    support_phone: workspace.supportPhone || "",
    country: workspace.country || "",
    timezone: workspace.timezone || "UTC",
    currency: workspace.currency || "USD",
    selected_plan_code: workspace.selectedPlanCode || "",
    is_active: workspace.isActive,
    rate_limit: workspace.rateLimit,
    created_at: workspace.createdAt,
    updated_at: workspace.updatedAt,
});

export const listWorkspaces = async (user: AuthenticatedUserContext) => {
    const workspaces = await Workspace.find(scope(user)).sort({ createdAt: -1 }).lean().exec();

    return workspaces.map(serialize);
};

export const createWorkspace = async (
    user: AuthenticatedUserContext,
    input: {
        name: string;
        business_name?: string;
        industry?: string;
        website_url?: string;
        support_email?: string;
        support_phone?: string;
        country?: string;
        timezone?: string;
        currency?: string;
        selected_plan_code?: string;
        rate_limit?: number;
    },
) => {
    if (user.role !== "super_admin") {
        throw forbiddenError("Only a global administrator can create workspaces");
    }

    const workspace = await Workspace.create({
        name: input.name.trim(),
        slug: await uniqueSlug(input.name),
        businessName: input.business_name?.trim() || "",
        industry: input.industry?.trim() || "",
        websiteUrl: input.website_url?.trim() || "",
        supportEmail: input.support_email?.trim().toLowerCase() || "",
        supportPhone: input.support_phone?.trim() || "",
        country: input.country?.trim() || "",
        timezone: input.timezone?.trim() || "UTC",
        currency: input.currency?.trim().toUpperCase() || "USD",
        selectedPlanCode: input.selected_plan_code?.trim().toLowerCase() || "",
        ownerId: user.id,
        rateLimit: input.rate_limit ?? 60,
        isActive: true,
    });

    await ensureWorkspaceChannelDefaults(workspace._id);
    return serialize(workspace);
};

export const getWorkspace = async (user: AuthenticatedUserContext, identifier: string) => {
    const accessScope = scope(user);
    const identifierScope = Types.ObjectId.isValid(identifier)
        ? { $or: [{ _id: identifier }, { slug: identifier }] }
        : { slug: identifier };
    const workspace = await Workspace.findOne({ ...accessScope, ...identifierScope }).lean().exec();

    if (!workspace) throw notFoundError("Workspace not found");

    return serialize(workspace);
};

export const updateWorkspace = async (
    user: AuthenticatedUserContext,
    identifier: string,
    input: {
        name?: string;
        business_name?: string;
        industry?: string;
        website_url?: string;
        support_email?: string;
        support_phone?: string;
        country?: string;
        timezone?: string;
        currency?: string;
        selected_plan_code?: string;
        is_active?: boolean;
        rate_limit?: number;
    },
) => {
    const workspace = await getWorkspace(user, identifier);
    const changes: Record<string, unknown> = {};

    if (input.name !== undefined) changes.name = input.name.trim();
    if (input.business_name !== undefined) changes.businessName = input.business_name.trim();
    if (input.industry !== undefined) changes.industry = input.industry.trim();
    if (input.website_url !== undefined) changes.websiteUrl = input.website_url.trim();
    if (input.support_email !== undefined) changes.supportEmail = input.support_email.trim().toLowerCase();
    if (input.support_phone !== undefined) changes.supportPhone = input.support_phone.trim();
    if (input.country !== undefined) changes.country = input.country.trim();
    if (input.timezone !== undefined) changes.timezone = input.timezone.trim();
    if (input.currency !== undefined) changes.currency = input.currency.trim().toUpperCase();
    if (input.selected_plan_code !== undefined) changes.selectedPlanCode = input.selected_plan_code.trim().toLowerCase();
    if (input.is_active !== undefined) changes.isActive = input.is_active;
    if (input.rate_limit !== undefined) changes.rateLimit = input.rate_limit;
    if (!Object.keys(changes).length) throw unprocessableEntityError("No workspace changes were supplied");

    const updated = await Workspace.findByIdAndUpdate(workspace.id, changes, {
        new: true,
        runValidators: true,
    }).lean().exec();

    if (!updated) throw notFoundError("Workspace not found");

    return serialize(updated);
};

export const deleteWorkspace = async (user: AuthenticatedUserContext, identifier: string) => {
    if (user.role !== "super_admin") {
        throw forbiddenError("Only a global administrator can delete workspaces");
    }

    const workspace = await getWorkspace(user, identifier);
    const updated = await Workspace.findByIdAndUpdate(
        workspace.id,
        { $set: { isActive: false } },
        { returnDocument: "after", runValidators: true },
    ).lean().exec();

    if (!updated) throw notFoundError("Workspace not found");

    // Workspace deletion is a soft delete so tenant data and credentials remain recoverable.
    return serialize(updated);
};
