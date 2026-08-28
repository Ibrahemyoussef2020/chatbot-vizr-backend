import type { CookieOptions } from "express";


const getCookieOptions = (maxAge?: number): CookieOptions => {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        ...(maxAge ? { maxAge } : {}),
        signed: true,
        ...(process.env.DOMAIN ? { domain: process.env.DOMAIN } : {}),
        path: "/",
    };
};


export default getCookieOptions;
export { getCookieOptions };

