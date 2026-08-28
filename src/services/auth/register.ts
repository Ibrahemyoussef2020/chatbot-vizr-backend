import bcrypt from "bcrypt";
import { unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import User from "../../models/User.js";
import createToken, { UserTokenPayload } from "../../utils/createToken.js";
import { createInitialWorkspace } from "../workspaces.js";

interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

interface RegisterResult {
    userInfo: {
        id: unknown;
        name: string;
        email: string;
        role: "admin";
        workspaceId: unknown;
    };
    accessToken: string;
    refreshToken: string;
}

const registerService = async ({ name, email, password }: RegisterInput): Promise<RegisterResult> => {
    const didEmailUse = await User.findOne({ email });
    if (didEmailUse) {
        throw unprocessableEntityError("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        name,
        email,
        password: hashedPassword,
    });

    try {
        await user.save();
    } catch (error) {
        throw error;
    }

    let workspace;

    try {
        workspace = await createInitialWorkspace(user._id, user.name);
    } catch (error) {
        await User.findByIdAndDelete(user._id);
        throw error;
    }

    const tokenPayload: UserTokenPayload = {
        id: user._id,
        email: user.email,
        name: user.name,
    };

    const { accessToken, refreshToken } = createToken(tokenPayload);

    return {
        userInfo: {
            ...tokenPayload,
            role: "admin",
            workspaceId: workspace._id,
        },
        accessToken,
        refreshToken,
    };
};

export default registerService;
