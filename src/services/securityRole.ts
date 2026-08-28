import { Workspace, SecurityRole } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const listRolesService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    const filter = ws ? { $or: [{ workspaceId: ws._id }, { workspaceId: null }] } : {};
    const roles = await SecurityRole.find(filter).sort({ createdAt: -1 }).exec();

    if (roles.length === 0) {
        const seeded = await SecurityRole.insertMany([
            { name: "Super Administrator", workspaceId: null, permissions: ["all_access", "manage_system", "manage_users", "view_analytics"], users_count: 3 },
            { name: "Workspace Owner", workspaceId: ws?._id || null, permissions: ["manage_workspace", "manage_bot", "view_analytics", "manage_tags"], users_count: 5 },
            { name: "Support Specialist", workspaceId: ws?._id || null, permissions: ["inbox_reply", "assign_agent", "tag_threads"], users_count: 12 },
        ]);
        return seeded.map((r) => ({
            id: r._id.toString(),
            name: r.name,
            system_id: r.workspaceId ? r.workspaceId.toString() : null,
            permissions: r.permissions.map((p) => ({ id: p, name: p })),
            users_count: r.users_count,
        }));
    }

    return roles.map((r) => ({
        id: r._id.toString(),
        name: r.name,
        system_id: r.workspaceId ? r.workspaceId.toString() : null,
        permissions: r.permissions.map((p) => ({ id: p, name: p })),
        users_count: r.users_count,
    }));
};

export const saveRoleService = async (
    payload: { name: string; system_id?: string | null; selectedPermissions?: string[] },
    roleId?: string,
) => {
    let role;
    if (roleId) {
        role = await SecurityRole.findById(roleId).exec();
    }
    if (!role) {
        role = new SecurityRole();
    }

    role.name = payload.name;
    role.permissions = payload.selectedPermissions || [];
    await role.save();
    return true;
};

export const deleteRoleService = async (roleId: string) => {
    await SecurityRole.findByIdAndDelete(roleId).exec();
    return true;
};

export const listPermissionsService = () => {
    return [
        { id: "all_access", name: "Full System Access", roles_count: 1 },
        { id: "manage_workspace", name: "Manage Workspace Settings", roles_count: 2 },
        { id: "manage_bot", name: "Configure AI Bot & Knowledge", roles_count: 2 },
        { id: "view_analytics", name: "View Token & Performance Telemetry", roles_count: 3 },
        { id: "inbox_reply", name: "Customer Inbox & Live Reply", roles_count: 3 },
        { id: "assign_agent", name: "Assign Support Tickets", roles_count: 3 },
        { id: "manage_tags", name: "Manage Workspace Tags", roles_count: 2 },
        { id: "export_logs", name: "Export System Telemetry Logs", roles_count: 1 },
    ];
};
