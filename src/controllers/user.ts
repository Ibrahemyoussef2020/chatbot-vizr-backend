import express from "express";
import { User } from "../models/index.js";

export const getAllUsers = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
        const users = await User.find().select("-password");
        return res.status(200).json({ message: "Users fetched successfully", users });
    } catch (error) {
        next(error);
    }
};