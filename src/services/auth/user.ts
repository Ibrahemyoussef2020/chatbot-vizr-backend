import { User } from "../../models/index.js";
import { SecurityRole, Workspace } from "../../models/index.js";
import { forbiddenError, notFoundError } from "../../core/shared/errors/HttpError.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import bcrypt from "bcrypt";
import { unprocessableEntityError } from "../../core/shared/errors/HttpError.js";

export const getAllUsersService = async () => {
    return await User.find().select("-password");
};

const rank = (code?: string) => ({ business_owner: 5, business_admin: 4, workspace_owner: 4, workspace_admin: 3, workspace_agent: 2 }[code || ""] || 1);

export const listWorkspaceUsersService = async (actor: AuthenticatedUserContext, slug?: string) => {
    const workspace = slug
        ? await Workspace.findOne({ slug: slug.toLowerCase() }).lean()
        : actor.workspaceId ? await Workspace.findById(actor.workspaceId).lean() : null;
    if (!workspace) throw notFoundError("Workspace not found.");
    if (actor.role !== "super_admin" && String(workspace.ownerId) !== actor.id && String(workspace._id) !== String(actor.workspaceId || "")) {
        throw forbiddenError("You cannot manage users outside your workspace.");
    }
    const users = await User.find({ workspaceId: workspace._id }).select("name email role workspaceId securityRoleId isActive").populate("securityRoleId", "name code scope").lean();
    return users.map((user: any) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        // Legacy principals may have no User.role; their canonical role is
        // stored on the security role record instead.
        legacyRole: user.role || user.securityRoleId?.code || "member",
        isActive: user.isActive,
        securityRole: user.securityRoleId ? { id: String(user.securityRoleId._id), name: user.securityRoleId.name, code: user.securityRoleId.code, scope: user.securityRoleId.scope } : null,
    }));
};

export const assignWorkspaceUserRoleService = async (actor: AuthenticatedUserContext, userId: string, roleId: string, slug?: string) => {
    const users = await listWorkspaceUsersService(actor, slug);
    const target = users.find((user) => user.id === userId);
    if (!target) throw notFoundError("User not found in this workspace.");
    if (String(target.id) === String(actor.id)) throw forbiddenError("You cannot edit your own role.");
    const current = await SecurityRole.findById(actor.securityRoleId).select("code").lean();
    const role = await SecurityRole.findById(roleId).exec();
    if (!role) throw notFoundError("Security role not found.");
    if (role.workspaceId && String(role.workspaceId) !== String((await Workspace.findOne({ slug: slug?.toLowerCase() }).lean())?._id || actor.workspaceId)) throw forbiddenError("Role belongs to another workspace.");
    if (rank(role.code) >= rank(current?.code)) throw forbiddenError("You cannot assign a role at or above your access level.");
    await User.findByIdAndUpdate(userId, { securityRoleId: role._id, role: role.code === "workspace_agent" ? "agent" : "admin" });
    return true;
};

export const createWorkspaceUserService = async (actor: AuthenticatedUserContext, input: { name: string; email: string; password: string; roleId: string }, slug?: string) => {
    const workspace = slug ? await Workspace.findOne({ slug: slug.toLowerCase() }).lean() : await Workspace.findById(actor.workspaceId).lean();
    if (!workspace) throw notFoundError("Workspace not found.");
    if (actor.role !== "super_admin" && String(workspace.ownerId) !== actor.id && String(workspace._id) !== String(actor.workspaceId || "")) throw forbiddenError("You cannot manage users outside your workspace.");
    const email = String(input.email || "").trim().toLowerCase();
    const name = String(input.name || "").trim();
    const password = String(input.password || "");
    if (!name || !email || password.length < 8 || !input.roleId) throw unprocessableEntityError("Name, email, password (minimum 8 characters), and security role are required.");
    if (await User.exists({ email })) throw unprocessableEntityError("Email already exists.");
    const current = await SecurityRole.findById(actor.securityRoleId).select("code").lean();
    const currentCode = current?.code || (actor.role === "super_admin" ? "business_owner" : "workspace_owner");
    const role = await SecurityRole.findById(input.roleId).exec();
    if (!role) throw notFoundError("Security role not found.");
    if (role.workspaceId && String(role.workspaceId) !== String(workspace._id)) throw forbiddenError("Role belongs to another workspace.");
    if (rank(role.code) >= rank(currentCode)) throw forbiddenError("You cannot assign a role at or above your access level.");
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), workspaceId: workspace._id, securityRoleId: role._id, role: role.code === "workspace_agent" ? "agent" : "admin", isActive: true });
    return { id: String(user._id), name: user.name, email: user.email, legacyRole: user.role, isActive: user.isActive, securityRole: { id: String(role._id), name: role.name, code: role.code, scope: role.scope } };
};
