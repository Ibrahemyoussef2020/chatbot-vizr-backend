import { Request, Response } from "express";
import { listRolesService, saveRoleService, deleteRoleService, listPermissionsService } from "../services/securityRole.js";

const parseSlug = (req: Request): string | undefined => {
    const slug = req.query.system_slug || req.query.system || req.body?.system_slug;
    return typeof slug === "string" ? slug : undefined;
};

export const getRoles = async (req: Request, res: Response): Promise<void> => {
    try {
        const slug = parseSlug(req);
        const roles = await listRolesService(slug);
        res.json({ success: true, data: roles });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch security roles." });
    }
};

export const saveRole = async (req: Request, res: Response): Promise<void> => {
    try {
        const roleId = typeof req.params.id === "string" ? req.params.id : undefined;
        await saveRoleService(req.body, roleId);
        res.json({ success: true, message: "Role saved successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to save role." });
    }
};

export const deleteRole = async (req: Request, res: Response): Promise<void> => {
    try {
        const roleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await deleteRoleService(roleId);
        res.json({ success: true, message: "Role deleted successfully." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to delete role." });
    }
};

export const getPermissions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const permissions = listPermissionsService();
        res.json({ success: true, data: permissions });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message || "Failed to fetch permissions." });
    }
};
