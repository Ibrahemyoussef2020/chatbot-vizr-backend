import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { seedConversations } from "./conversation.seeder.js";
import { assignUserWorkspace, seedAgentUser, seedBusinessOwner, seedWorkspaceOwners } from "./user.seeder.js";
import { seedWorkspaces } from "./workspace.seeder.js";
import { seedConfig } from "./config.js";
import { seedTokenLogs } from "./tokenLog.seeder.js";
import { seedTags } from "./tag.seeder.js";
import { seedSystemLogs } from "./systemLog.seeder.js";
import { seedKnowledgeOutputs } from "./knowledgeOutput.seeder.js";

const runSeeders = async () => {
    await connectDB();

    console.log("Seeding Vizr business owner and client workspace owners...");
    const businessOwner = await seedBusinessOwner();
    const clientOwners = await seedWorkspaceOwners();

    console.log("Seeding business-owned and client-owned workspaces...");
    const workspaces = await seedWorkspaces(businessOwner._id, clientOwners);

    console.log("Assigning each owner to the correct workspace...");
    const firstBusinessWorkspace = workspaces.find((workspace) => workspace.slug === "brand-ecommerce");
    if (!firstBusinessWorkspace) throw new Error("Brand business workspace was not seeded.");
    await assignUserWorkspace(businessOwner._id, firstBusinessWorkspace._id);
    for (const account of seedConfig.users.workspaceOwners) {
        const owner = clientOwners.get(account.key);
        const workspace = workspaces.find((item) => item.ownerId.equals(owner?._id));
        if (owner && workspace) await assignUserWorkspace(owner._id, workspace._id);
    }
    await seedAgentUser(firstBusinessWorkspace._id);

    console.log("Seeding Brand and Vizr knowledge sessions, plans, and reports...");
    const knowledgeResult = await seedKnowledgeOutputs(workspaces);

    console.log("Seeding dashboard conversations and messages...");
    const convResult = await seedConversations();

    console.log("Seeding token analytics telemetry...");
    const tokenResult = await seedTokenLogs();

    console.log("Seeding CRM tags...");
    const tagResult = await seedTags();

    console.log("Seeding system logs...");
    const logResult = await seedSystemLogs();

    console.log(
        `Seed complete: ${workspaces.length} workspaces (${convResult.conversations} conversations, ${tokenResult.tokenLogs} token logs, ${tagResult.tags} tags, ${logResult.logs} logs, ${knowledgeResult.sessions} knowledge sessions, ${knowledgeResult.outputs} generated outputs, ${knowledgeResult.schemas} output schemas).`,
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
