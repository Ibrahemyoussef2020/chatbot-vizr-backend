import type { CookieOptions } from "express";

const configuredDomain = process.env.DOMAIN?.trim();
// A localhost domain is invalid once the API is deployed on Vercel. In that
// case the browser rejects the refresh cookie, so a payment-provider return
// looks like a logged-out session. Let the API host own the cookie instead.
const cookieDomain = configuredDomain
    && !["localhost", "127.0.0.1"].includes(configuredDomain)
    ? configuredDomain
    : undefined;

const getCookieOptions = (maxAge?: number): CookieOptions => {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        ...(maxAge ? { maxAge } : {}),
        signed: true,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
        path: "/",
    };
};


export default getCookieOptions;
export { getCookieOptions };

