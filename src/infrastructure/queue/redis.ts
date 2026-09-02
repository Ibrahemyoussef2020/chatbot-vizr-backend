import { Redis } from "ioredis";

export const redisUrl = () => {
    const url = process.env.REDIS_URL?.trim();
    if (!url) throw new Error("Missing REDIS_URL for BullMQ.");
    return url;
};

export const createBullMQConnection = (role: "producer" | "worker" = "worker") => new Redis(redisUrl(), {
    maxRetriesPerRequest: role === "worker" ? null : 1,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5_000),
});
