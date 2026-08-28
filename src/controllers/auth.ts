import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getCookieOptions } from "../lib/index.js";
import { authService } from "../services/index.js";

const register = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.registerService(req.body);

    res.cookie("jwt", result.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(201).json({
        userInfo: result.userInfo,
        accessToken: result.accessToken,
        status: 201,
        message: "User registered successfully",
    });
});

const login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.loginService(req.body);

    res.cookie("jwt", result.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
        userInfo: result.userInfo,
        accessToken: result.accessToken,
        status: 200,
        message: "User logged in successfully",
    });
});

const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    await authService.logoutService(req.signedCookies?.jwt ?? req.cookies?.jwt);

    res.clearCookie("jwt", getCookieOptions());

    return res.status(200).json({ message: "logout successful" });
});

const checkStatus = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.getSessionService({
        refreshToken: req.signedCookies?.jwt ?? req.cookies?.jwt,
        accessToken: req.get("X-Authorization") ?? req.get("Authorization"),
        optional: true,
    });

    return res.status(200).json({
        authenticated: Boolean(result),
        ...(result ?? {}),
        status: 200,
    });
});

const profile = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const result = await authService.getSessionService({
        refreshToken: req.signedCookies?.jwt ?? req.cookies?.jwt,
        accessToken: req.get("X-Authorization") ?? req.get("Authorization"),
    });

    return res.status(200).json({ authenticated: true, ...result, status: 200 });
});

export { register, login, logout, checkStatus, profile };
export default { register, login, logout, checkStatus, profile };
