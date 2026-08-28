import type { Types } from "mongoose";
import Workspace from "../models/Workspace.js";
import Conversation from "../models/Conversation.js";
import TokenLog from "../models/TokenLog.js";
import Tag from "../models/Tag.js";
import SystemLog from "../models/SystemLog.js";
import { seedConfig } from "./config.js";

const validSlugs = ["brand-ecommerce", "tawasal-social-media", "ibrahem-portfolio"];

export const migrateLegacyWorkspaceData = async () => {
    // 1. Migrate legacy conversation systemSlug values
    await Conversation.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await Conversation.updateMany({ systemSlug: { $in: ["test", "tests"] } }, { $set: { systemSlug: "tawasal-social-media" } });
    await Conversation.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 2. Migrate legacy TokenLog systemSlug values
    await TokenLog.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await TokenLog.updateMany({ systemSlug: { $in: ["test", "tests"] } }, { $set: { systemSlug: "tawasal-social-media" } });
    await TokenLog.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 3. Migrate legacy Tag systemSlug values
    await Tag.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await Tag.updateMany({ systemSlug: { $in: ["test", "tests"] } }, { $set: { systemSlug: "tawasal-social-media" } });
    await Tag.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 4. Migrate legacy SystemLog systemSlug values
    await SystemLog.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await SystemLog.updateMany({ systemSlug: { $in: ["test", "tests"] } }, { $set: { systemSlug: "tawasal-social-media" } });
    await SystemLog.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 5. Purge any old workspace documents outside the 3 target slugs
    await Workspace.deleteMany({ slug: { $nin: validSlugs } });
};

export const seedWorkspace = async (ownerId: Types.ObjectId) => {
    await migrateLegacyWorkspaceData();

    const seededWorkspaces = [];

    for (const wsConfig of seedConfig.workspaces) {
        const workspace = await Workspace.findOneAndUpdate(
            { slug: wsConfig.slug },
            {
                $set: {
                    name: wsConfig.name,
                    ownerId,
                    isActive: true,
                    rateLimit: wsConfig.rateLimit,
                },
            },
            { returnDocument: "after", upsert: true, runValidators: true },
        ).exec();

        if (workspace) {
            seededWorkspaces.push(workspace);
        }
    }

    return seededWorkspaces[0];
};
