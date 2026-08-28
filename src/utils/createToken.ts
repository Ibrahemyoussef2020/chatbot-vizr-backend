import jwt from "jsonwebtoken";

export interface UserTokenPayload {
    id: unknown;
    email: string;
    name: string;
}

const createToken = (user: UserTokenPayload) => {
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "default_access_token_secret";
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "default_refresh_token_secret";

    const accessToken = jwt.sign(
        {
            userInfo: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        },
        accessTokenSecret,
        { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
        {
            userInfo: {
                id: user.id,
            },
        },
        refreshTokenSecret,
        { expiresIn: "7d" }
    );

    return {
        accessToken,
        refreshToken,
    };
};

export default createToken;