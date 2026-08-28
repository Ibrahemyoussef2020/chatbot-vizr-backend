import type { RequestHandler } from "express";
const requests = new Map<string, { count: number; resetAt: number }>();
export const publicRateLimit: RequestHandler = (req, res, next) => {
    const now = Date.now(); const key = req.ip || "unknown"; const entry = requests.get(key);
    if (!entry || entry.resetAt <= now) requests.set(key, { count: 1, resetAt: now + 60_000 });
    else if (++entry.count > 60) { res.status(429).json({ message: "Too many requests", status: 429 }); return; }
    next();
};
