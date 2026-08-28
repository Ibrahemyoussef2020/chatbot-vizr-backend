import SystemLog from "../models/SystemLog.js";

export const getLogs = async (systemSlug?: string, level?: string, limit = 50) => {
    const query: Record<string, unknown> = {};
    if (systemSlug) query.systemSlug = systemSlug;
    if (level) query.level = level;

    const logs = await SystemLog.find(query).sort({ createdAt: -1 }).limit(limit).lean().exec();

    return logs.map((log) => ({
        id: log.publicId,
        level: log.level,
        category: log.category,
        message: log.message,
        metadata: log.metadata,
        createdAt: log.createdAt,
    }));
};
