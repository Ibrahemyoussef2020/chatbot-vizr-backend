import dotenv from "dotenv";
import mongoose from "mongoose";
import { parseArgs } from "node:util";
import { seedProductionAIManagement } from "./aiManagementProduction.seeder.js";
import { seedAITraffic } from "./aiTraffic.seeder.js";
import { seedAIQuotaBaseline } from "./aiQuotaBaseline.seeder.js";

const run = async () => {
    const { values } = parseArgs({ options: {
        "env-file": { type: "string" },
        workspace: { type: "string", multiple: true },
        provider: { type: "string" },
        model: { type: "string" },
        apply: { type: "boolean", default: false },
        traffic: { type: "string" },
        "quota-baseline": { type: "boolean", default: false },
    } });
    if (values["env-file"]) {
        const loaded = dotenv.config({ path: values["env-file"], override: true, quiet: true });
        if (loaded.error) throw new Error("Cannot load the selected environment file.");
    }
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
    if (Boolean(values.provider) !== Boolean(values.model)) {
        throw new Error("Supply both --provider and --model, or neither.");
    }
    mongoose.set("autoIndex", false);
    mongoose.set("autoCreate", false);
    const { default: connectDB } = await import("../db/index.js");
    await connectDB();
    const db = mongoose.connection.db!;
    const slugs = [...new Set(values.workspace ?? [])];
    const workspaces = await db.collection("workspaces").find(
        slugs.length ? { slug: { $in: slugs } } : {},
        { projection: { slug: 1, isActive: 1 } },
    ).toArray();
    for (const workspace of workspaces) {
        const counts: Record<string, number> = {};
        for (const collection of ["aiagents", "airoutingpolicies", "aiquotapolicies", "airequestlogs"]) {
            counts[collection] = await db.collection(collection).countDocuments({ workspaceId: workspace._id });
        }
        counts.runtimeLogs = await db.collection("airequestlogs").countDocuments({ workspaceId: workspace._id, source: "runtime" });
        console.log(JSON.stringify({ workspace: workspace.slug, counts }));
    }
    console.log(JSON.stringify({
        providers: await db.collection("aiproviders").countDocuments(),
        models: await db.collection("aimodels").countDocuments(),
    }));
    if (!values.apply) {
        console.log("Read-only inventory. Use --apply with explicit --workspace slugs to insert missing starter configuration.");
        return;
    }
    const modelConfig = values.provider && values.model
        ? { provider: values.provider, model: values.model }
        : undefined;
    if (values["quota-baseline"]) {
        console.log(await seedAIQuotaBaseline(slugs));
    } else if (values.traffic !== undefined) {
        console.log(await seedAITraffic(slugs, Number(values.traffic)));
    } else {
        console.log(await seedProductionAIManagement(slugs, modelConfig));
    }
};

run().catch(error => {
    // Connection errors can contain credentials or infrastructure details.
    console.error("AI production seed failed:", { name: error?.name, code: error?.code, syscall: error?.syscall });
    process.exitCode = 1;
}).finally(async () => {
    await mongoose.disconnect();
});
