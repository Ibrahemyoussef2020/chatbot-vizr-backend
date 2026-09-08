import { AIQuotaPolicy, Workspace } from "../models/index.js";

export const seedAIQuotaBaseline = async (slugs: string[]) => {
    const workspaces = await Workspace.find({ slug: { $in: slugs } }).lean();
    if (!slugs.length || slugs.some(slug => !workspaces.some(workspace => workspace.slug === slug))) {
        throw new Error("Explicit existing workspace slugs are required.");
    }
    const ratios = { agent: 0.68, model: 0.82, provider: 0.46, workspace: 0.57 };
    const quotas = await AIQuotaPolicy.find({ workspaceId: { $in: workspaces.map(workspace => workspace._id) } });
    let inserted = 0;
    for (const quota of quotas) {
        const result = await AIQuotaPolicy.updateOne(
            { _id: quota._id, "dashboardBaseline.tokens": { $exists: false } },
            { $set: { dashboardBaseline: {
                tokens: Math.round(quota.tokenLimit * ratios[quota.scope]),
                requests: Math.round(quota.requestLimit * ratios[quota.scope]),
            } } },
            { timestamps: false },
        );
        inserted += result.modifiedCount;
    }
    return { quotas: quotas.length, inserted };
};
