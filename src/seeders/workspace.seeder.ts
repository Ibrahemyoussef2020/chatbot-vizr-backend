import type { Types } from "mongoose";
import Workspace from "../models/Workspace.js";
import Conversation from "../models/Conversation.js";
import TokenLog from "../models/TokenLog.js";
import Tag from "../models/Tag.js";
import SystemLog from "../models/SystemLog.js";
import { seedConfig } from "./config.js";

export const migrateLegacyWorkspaceData = async () => {
    // 1. Migrate legacy conversation systemSlug values
    await Conversation.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await Conversation.updateMany({ systemSlug: { $in: ["test", "tests", "tawasal-social-media"] } }, { $set: { systemSlug: "vizr" } });
    await Conversation.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 2. Migrate legacy TokenLog systemSlug values
    await TokenLog.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await TokenLog.updateMany({ systemSlug: { $in: ["test", "tests", "tawasal-social-media"] } }, { $set: { systemSlug: "vizr" } });
    await TokenLog.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 3. Migrate legacy Tag systemSlug values
    await Tag.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await Tag.updateMany({ systemSlug: { $in: ["test", "tests", "tawasal-social-media"] } }, { $set: { systemSlug: "vizr" } });
    await Tag.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

    // 4. Migrate legacy SystemLog systemSlug values
    await SystemLog.updateMany({ systemSlug: "demo" }, { $set: { systemSlug: "brand-ecommerce" } });
    await SystemLog.updateMany({ systemSlug: { $in: ["test", "tests", "tawasal-social-media"] } }, { $set: { systemSlug: "vizr" } });
    await SystemLog.updateMany({ systemSlug: { $in: ["admin", "admin-dash", "vizr-demo-workspace"] } }, { $set: { systemSlug: "ibrahem-portfolio" } });

};

export const seedWorkspaces = async (
    businessOwnerId: Types.ObjectId,
    clientOwners: Map<string, { _id: Types.ObjectId } | null>,
) => {
    await migrateLegacyWorkspaceData();

    const seededWorkspaces = [];

    for (const wsConfig of seedConfig.workspaces) {
        const ownerId = wsConfig.ownership === "business"
            ? businessOwnerId
            : clientOwners.get(wsConfig.ownerKey)?._id;
        if (!ownerId) throw new Error(`Missing seeded owner for workspace ${wsConfig.slug}.`);
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

    return seededWorkspaces;
};
