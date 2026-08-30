import express from "express";
import * as userService from "../services/user.js";

export const getAllUsers = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const users = await userService.getAllUsersService();
        return res.status(200).json({ message: "Users fetched successfully", users });
    } catch (error) {
        next(error);
    }
};