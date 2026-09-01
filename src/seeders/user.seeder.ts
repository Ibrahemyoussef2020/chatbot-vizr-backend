import type { Types } from "mongoose";
import { passwordUtils } from "../lib/index.js";
import User from "../models/User.js";
import { seedConfig } from "./config.js";

const upsertAccount = async (account: { name: string; email: string; password: string; legacyRole: "super_admin" | "admin" }) =>
    User.findOneAndUpdate(
        { email: account.email },
        { $set: { name: account.name, password: await passwordUtils.hash(account.password), role: account.legacyRole, isActive: true } },
        { returnDocument: "after", upsert: true, runValidators: true },
    ).exec();

export const seedBusinessOwner = () => upsertAccount(seedConfig.users.businessOwner);

export const seedWorkspaceOwners = async () => {
    const owners = new Map<string, Awaited<ReturnType<typeof upsertAccount>>>();
    for (const account of seedConfig.users.workspaceOwners) owners.set(account.key, await upsertAccount(account));
    return owners;
};

export const assignUserWorkspace = (userId: Types.ObjectId, workspaceId: Types.ObjectId) =>
    User.findByIdAndUpdate(userId, { workspaceId }, { returnDocument: "after", runValidators: true }).exec();

export const seedAgentUser = async (workspaceId: Types.ObjectId) => User.findOneAndUpdate(
    { email: seedConfig.users.agent.email },
    { $set: { name: seedConfig.users.agent.name, password: await passwordUtils.hash(seedConfig.users.agent.password), role: "agent", workspaceId, isActive: true } },
    { returnDocument: "after", upsert: true, runValidators: true },
).exec();
