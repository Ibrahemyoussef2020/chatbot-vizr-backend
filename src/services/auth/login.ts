import { unauthorizedError } from "../../core/shared/errors/HttpError.js";
import { passwordUtils } from "../../lib/index.js";
import User from "../../models/User.js";
import createToken, { UserTokenPayload } from "../../utils/createToken.js";
import { ensureUserWorkspace } from "../workspaces.js";
import getSessionService from "./session.js";

export interface UserLoginInput {
    email: string;
    password: string;
}

export interface LoginResult {
    userInfo: UserTokenPayload & {
        role: string;
        workspaceId?: unknown;
        permissions?: string[];
    };
    accessToken?: string;
    refreshToken?: string;
}

const loginService = async ({ email, password }: UserLoginInput): Promise<LoginResult> => {
    const foundUser = await User.findOne({ email }).exec();
    if (!foundUser) {
        throw unauthorizedError("User is not found");
    }

    if (!foundUser.isActive) {
        throw unauthorizedError("This account is inactive");
    }

    const doesPasswordMatch = await passwordUtils.compare(password, foundUser.password);

    if (!doesPasswordMatch) {
        throw unauthorizedError("Credentials do not match");
    }

    const workspaceId = await ensureUserWorkspace(foundUser);
    const tokenPayload: UserTokenPayload = {
        id: foundUser._id,
        email: foundUser.email,
        name: foundUser.name, 
    };

    const token = createToken(tokenPayload);

    const { accessToken, refreshToken } = token;
    const session = await getSessionService({ accessToken });

    return {
        userInfo: {
            ...tokenPayload,
            role: foundUser.role,
            workspaceId,
            permissions: session?.userInfo.permissions || [],
        },
        accessToken,
        refreshToken,
    };
};

export default loginService;
