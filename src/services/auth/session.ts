import jwt from "jsonwebtoken";
import { unauthorizedError } from "../../core/shared/errors/HttpError.js";
import User from "../../models/User.js";
import type { UserTokenPayload } from "../../utils/createToken.js";
import { ensureUserWorkspace } from "../workspaces.js";

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

    return {
        userInfo: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            workspaceId,
        },
    };
};

export default getSessionService;
