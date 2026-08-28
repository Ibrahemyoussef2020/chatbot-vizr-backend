import type { Types } from "mongoose";
import { passwordUtils } from "../lib/index.js";
import User from "../models/User.js";
import { seedConfig } from "./config.js";

export const seedAdminUser = async () => {
    const password = await passwordUtils.hash(seedConfig.users.admin.password);

    return User.findOneAndUpdate(
        { email: seedConfig.users.admin.email },
        {
            $set: {
                name: seedConfig.users.admin.name,
                password,
                role: "super_admin",
                isActive: true,
            },
        },
        { returnDocument: "after", upsert: true, runValidators: true },
    ).exec();
};

export const assignAdminWorkspace = async (
    adminId: Types.ObjectId,
    workspaceId: Types.ObjectId,
) => {
    return User.findByIdAndUpdate(
        adminId,
        { workspaceId },
        { returnDocument: "after", runValidators: true },
    ).exec();
};

export const seedAgentUser = async (workspaceId: Types.ObjectId) => {
    const password = await passwordUtils.hash(seedConfig.users.agent.password);

    return User.findOneAndUpdate(
        { email: seedConfig.users.agent.email },
        {
            $set: {
                name: seedConfig.users.agent.name,
                password,
                role: "agent",
                workspaceId,
                isActive: true,
            },
        },
        { returnDocument: "after", upsert: true, runValidators: true },
    ).exec();
};
