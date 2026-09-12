import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import { TelegramBot, MetaChannelConfig, Workspace } from "../models/index.js";
import { initializeAllWorkspaceChannelDefaults } from "../services/channelDefaults.js";
import { listFilteredThreads } from "../services/threadManagement.js";

// Existing global account indexes must become workspace-scoped before defaults can be copied.
const run = async () => {
    dns.setServers((process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1").split(","));
    await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 });
    for (const [model, accountField] of [[TelegramBot, "telegram_bot_id"], [MetaChannelConfig, "instagramAccountId"]] as const) {
        await model.collection.createIndex({ workspaceId: 1, [accountField]: 1 }, { unique: true });
        const indexes = await model.collection.indexes();
        for (const index of indexes) {
            if (index.unique && Object.keys(index.key).length === 1 && index.key[accountField] === 1 && index.name) {
                await model.collection.dropIndex(index.name);
            }
        }
    }
    console.log(`Default platform accounts initialized for ${await initializeAllWorkspaceChannelDefaults()} workspaces.`);
    if (process.argv.includes("--initialize-only")) return;
    const workspaces = await Workspace.find({}).select("slug").lean().exec();
    const user = { id: "migration", name: "Migration", email: "migration@example.test", role: "super_admin" as const };
    for (const workspace of workspaces) {
        const counts: Record<string, number> = {};
        for (const channel of ["whatsapp", "telegram", "gmail", "instagram"]) {
            counts[channel] = (await listFilteredThreads(user, { systemSlug: workspace.slug, channel, days: 30 })).total;
        }
        console.log(JSON.stringify({ workspace: workspace.slug, inboxCounts: counts }));
    }
};

run().catch(error => { console.error(error.name, error.code || "Default account initialization failed"); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
