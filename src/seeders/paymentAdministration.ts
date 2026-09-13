import dotenv from "dotenv";
import mongoose from "mongoose";
import { parseArgs } from "node:util";
import Plan from "../models/Plan.js";
import PaymentMethodConfig from "../models/PaymentMethodConfig.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import Subscription from "../models/Subscription.js";
import Workspace from "../models/Workspace.js";
import { seedPaymentAdministration } from "./paymentAdministration.seeder.js";

const run = async () => {
    const { values } = parseArgs({ options: {
        "env-file": { type: "string", default: ".env" },
        workspace: { type: "string", multiple: true },
        apply: { type: "boolean", default: false },
    } });
    const slugs = [...new Set(values.workspace || [])];
    if (!slugs.length) throw new Error("Supply --workspace for each workspace to seed.");
    const loaded = dotenv.config({ path: values["env-file"], override: true, quiet: true });
    if (loaded.error) throw new Error("Cannot load the selected environment file.");
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

    mongoose.set("autoIndex", false);
    mongoose.set("autoCreate", false);
    const { default: connectDB } = await import("../db/index.js");
    await connectDB();
    const workspaces = await Workspace.find({ slug: { $in: slugs } }).select("_id slug").lean().exec();
    const missing = slugs.filter(slug => !workspaces.some(workspace => workspace.slug === slug));
    if (missing.length) throw new Error(`Unknown workspaces: ${missing.join(", ")}`);

    const counts = {
        pricings: await Plan.countDocuments(),
        paymentMethods: await PaymentMethodConfig.countDocuments(),
        payments: await PaymentTransaction.countDocuments({ workspaceId: { $in: workspaces.map(workspace => workspace._id) } }),
        subscriptions: await Subscription.countDocuments({ workspaceId: { $in: workspaces.map(workspace => workspace._id) } }),
    };
    console.log(JSON.stringify({ mode: values.apply ? "apply" : "preview", workspaces: slugs, existing: counts }));
    if (!values.apply) {
        console.log("Preview only. Add --apply to insert missing pricing/method templates and sample payment/subscription records.");
        return;
    }
    const result = await seedPaymentAdministration(slugs);
    console.log(JSON.stringify(result));
};

run().catch(error => {
    console.error("Payment seed failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
}).finally(async () => {
    await mongoose.disconnect();
});
