import cors from "cors";

const getConfiguredOrigins = (): string[] => {
    return (process.env.ALLOWED_URI || "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
};

export const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    const configuredOrigins = getConfiguredOrigins();
    if (configuredOrigins.includes(origin)) return true;
    if (/\.vercel\.app$/.test(origin)) return true;
    if (/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
    return false;
};


export const corsMiddleware = cors({
    origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
});

export default corsMiddleware;
