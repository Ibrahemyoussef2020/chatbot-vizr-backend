import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { seedConversations } from "./conversation.seeder.js";
import { assignAdminWorkspace, seedAdminUser, seedAgentUser } from "./user.seeder.js";
import { seedWorkspace } from "./workspace.seeder.js";
import { seedTokenLogs } from "./tokenLog.seeder.js";
import { seedTags } from "./tag.seeder.js";
import { seedSystemLogs } from "./systemLog.seeder.js";

const runSeeders = async () => {
    await connectDB();

    console.log("Seeding admin user...");
    const admin = await seedAdminUser();

    console.log("Seeding workspace...");
    const workspace = await seedWorkspace(admin._id);

    console.log("Assigning workspace users...");
    await assignAdminWorkspace(admin._id, workspace._id);
    await seedAgentUser(workspace._id);

    console.log("Seeding dashboard conversations and messages...");
    const convResult = await seedConversations();

    console.log("Seeding token analytics telemetry...");
    const tokenResult = await seedTokenLogs();

    console.log("Seeding CRM tags...");
    const tagResult = await seedTags();

    console.log("Seeding system logs...");
    const logResult = await seedSystemLogs();

    console.log(
        `Seed complete: ${workspace.name} (${convResult.conversations} conversations, ${tokenResult.tokenLogs} token logs, ${tagResult.tags} tags, ${logResult.logs} logs).`,
    );
};

runSeeders()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
