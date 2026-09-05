import jwt from "jsonwebtoken";
import { unauthorizedError } from "../../core/shared/errors/HttpError.js";
import User from "../../models/User.js";
import type { UserTokenPayload } from "../../utils/createToken.js";
import { ensureUserWorkspace } from "../workspaces.js";
import SecurityRole from "../../models/SecurityRole.js";
import { businessPermissionIds, workspacePermissionIds } from "../../core/security/permission.registry.js";

interface SessionInput {
    refreshToken?: string;
    accessToken?: string;
    optional?: boolean;
}

const bearerToken = (value?: string) => value?.replace(/^(?:Bearer\s+)?/i, "").trim();

const getSessionService = async ({ refreshToken, accessToken, optional = false }: SessionInput) => {
    const usingRefreshToken = Boolean(refreshToken);
    const token = refreshToken ?? bearerToken(accessToken);
    if (!token) {
        if (optional) return null;
        throw unauthorizedError("Not authenticated");
    }

    const secret = usingRefreshToken
        ? process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "default_refresh_token_secret"
        : process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "default_access_token_secret";

    let payload: { userInfo?: Pick<UserTokenPayload, "id"> };
    try {
        payload = jwt.verify(token, secret) as typeof payload;
    } catch {
        if (optional) return null;
        throw unauthorizedError("Invalid session");
    }

    if (!payload.userInfo?.id) {
        if (optional) return null;
        throw unauthorizedError("Invalid session");
    }
    const user = await User.findById(payload.userInfo.id).select("-password").exec();
    if (!user) {
        if (optional) return null;
        throw unauthorizedError("User not found");
    }

    if (!user.isActive) {
        if (optional) return null;
        throw unauthorizedError("This account is inactive");
    }

    const workspaceId = await ensureUserWorkspace(user);
    let securityRole = user.securityRoleId ? await SecurityRole.findById(user.securityRoleId).exec() : null;
    if (!securityRole) {
        const isBusinessPrincipal = user.role === "super_admin";
        securityRole = await SecurityRole.findOneAndUpdate(
            { workspaceId: isBusinessPrincipal ? null : workspaceId, code: isBusinessPrincipal ? "business_owner" : "workspace_owner" },
            { $setOnInsert: { name: isBusinessPrincipal ? "Business Owner" : "Workspace Owner", description: "System role assigned during legacy principal migration.", scope: isBusinessPrincipal ? "business" : "workspace", isSystem: true, permissions: isBusinessPrincipal ? businessPermissionIds : workspacePermissionIds } },
            { upsert: true, new: true },
        ).exec();
        user.securityRoleId = securityRole._id;
        await user.save();
    }
    const synchronizedPermissions = securityRole.code === "business_owner"
        ? businessPermissionIds
        : securityRole.code === "workspace_owner"
            ? workspacePermissionIds
            : securityRole.permissions;
    if (securityRole.isSystem && synchronizedPermissions.some((permission) => !securityRole!.permissions.includes(permission))) {
        securityRole.permissions = synchronizedPermissions;
        await securityRole.save();
    }

    return {
        userInfo: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            workspaceId,
            securityRoleId: securityRole._id,
            permissions: synchronizedPermissions,
        },
    };
};

export default getSessionService;
