import { forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import { businessPermissionIds, permissionRegistry, workspacePermissionIds } from "../core/security/permission.registry.js";
import { Workspace, SecurityRole } from "../models/index.js";
import type { AuthenticatedUserContext } from "./workspaces.js";

const workspaceForUser = async (user: AuthenticatedUserContext, slug?: string) => {
    const workspace = slug
        ? await Workspace.findOne({ slug: slug.toLowerCase() }).exec()
        : await Workspace.findById(user.workspaceId).exec();
    if (!workspace) throw notFoundError("Workspace not found.");
    if (user.role !== "super_admin" && String(workspace._id) !== user.workspaceId) {
        throw forbiddenError("You cannot manage roles outside your workspace.");
    }
    return workspace;
};

const agentPermissions = ["inbox.view", "inbox.reply_assigned", "inbox.status.manage", "inbox.notes.manage", "knowledge.use", "workspace.customers.manage"];
const workspaceAdminPermissions = workspacePermissionIds.filter((id) => !["billing.manage", "workspace.permissions.assign"].includes(id));
const businessAdminPermissions = businessPermissionIds.filter((id) => !["business.manage", "plans.manage", "workspaces.create"].includes(id));

const defaultsFor = (workspaceId?: string) => workspaceId ? [
    { code: "workspace_owner", name: "Workspace Owner", description: "Subscriber with complete authority inside this workspace.", permissions: workspacePermissionIds },
    { code: "workspace_admin", name: "Workspace Admin", description: "Owner-appointed assistant who administers workspace operations.", permissions: workspaceAdminPermissions },
    { code: "workspace_agent", name: "Workspace Agent", description: "Replies only to assigned conversations using approved knowledge.", permissions: agentPermissions },
] : [
    { code: "business_owner", name: "Business Owner", description: "Ibrahim Dev: owns Vizr and its business workspaces, without access to client workspaces.", permissions: businessPermissionIds },
    { code: "business_admin", name: "Business Admin", description: "Business-owner assistant with delegated platform permissions.", permissions: businessAdminPermissions },
];

const ensureDefaults = async (workspaceId?: string) => Promise.all(defaultsFor(workspaceId).map((role) =>
    SecurityRole.findOneAndUpdate(
        { workspaceId: workspaceId || null, code: role.code },
        { $setOnInsert: { ...role, workspaceId: workspaceId || null, scope: workspaceId ? "workspace" : "business", isSystem: true, users_count: role.code === "business_owner" ? 1 : 0 } },
        { upsert: true, new: true },
    ).exec(),
));

const serialize = (role: any) => ({
    id: String(role._id), code: role.code, name: role.name,
    description: role.description || "", scope: role.scope,
    is_system: role.isSystem, system_id: role.workspaceId ? String(role.workspaceId) : null,
    permissions: role.permissions.map((id: string) => ({ id, name: id })), users_count: role.users_count,
});

export const listRolesService = async (user: AuthenticatedUserContext, slug?: string) => {
    const workspace = await workspaceForUser(user, slug);
    await ensureDefaults(String(workspace._id));
    if (user.role === "super_admin") await ensureDefaults();
    const filter = user.role === "super_admin"
        ? { code: { $exists: true }, $or: [{ workspaceId: workspace._id }, { workspaceId: null }] }
        : { workspaceId: workspace._id, code: { $exists: true } };
    return (await SecurityRole.find(filter).sort({ scope: 1, name: 1 }).exec()).map(serialize);
};

export const saveRoleService = async (user: AuthenticatedUserContext, payload: any, roleId?: string) => {
    const workspace = await workspaceForUser(user, payload.system_slug);
    const valid = new Set(permissionRegistry.map((item) => item.id));
    const permissions = [...new Set<string>(payload.selectedPermissions || [])];
    if (permissions.some((id) => !valid.has(id))) throw unprocessableEntityError("One or more permissions are invalid.");
    let role = roleId ? await SecurityRole.findById(roleId).exec() : null;
    if (role?.workspaceId && String(role.workspaceId) !== String(workspace._id)) throw forbiddenError("Role belongs to another workspace.");
    if (role && !role.workspaceId && user.role !== "super_admin") throw forbiddenError("Only the business owner can edit business roles.");
    if (!role) role = new SecurityRole({ workspaceId: workspace._id, scope: "workspace", isSystem: false, code: `custom_${Date.now()}` });
    role.name = String(payload.name || "").trim();
    role.permissions = permissions;
    await role.save();
    return serialize(role);
};

export const deleteRoleService = async (user: AuthenticatedUserContext, roleId: string) => {
    const role = await SecurityRole.findById(roleId).exec();
    if (!role) throw notFoundError("Role not found.");
    if (role.isSystem) throw forbiddenError("Built-in roles cannot be deleted.");
    if (user.role !== "super_admin" && String(role.workspaceId) !== user.workspaceId) throw forbiddenError("Role belongs to another workspace.");
    await role.deleteOne();
    return true;
};

export const listPermissionsService = () => permissionRegistry.map((item) => ({ ...item, roles_count: 0 }));
