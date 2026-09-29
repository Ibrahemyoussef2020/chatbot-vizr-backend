import express from "express";
import * as userService from "../services/auth/user.js";

const slug = (req: express.Request) => typeof req.query.system_slug === "string" ? req.query.system_slug : undefined;

export const getAllUsers = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const users = await userService.getAllUsersService();
        return res.status(200).json({ message: "Users fetched successfully", users });
    } catch (error) {
        next(error);
    }
};

export const getWorkspaceUsers = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { res.json({ success: true, data: await userService.listWorkspaceUsersService(res.locals.user, slug(req)) }); } catch (error) { next(error); }
};

export const assignWorkspaceUserRole = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { await userService.assignWorkspaceUserRoleService(res.locals.user, String(req.params.id), String(req.body.roleId), slug(req)); res.json({ success: true }); } catch (error) { next(error); }
};

export const createWorkspaceUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try { const { name, email, password, roleId } = req.body || {}; res.status(201).json({ success: true, data: await userService.createWorkspaceUserService(res.locals.user, { name, email, password, roleId }, slug(req)) }); } catch (error) { next(error); }
};
