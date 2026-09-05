import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * A 32-byte key derived from PAYMENT_CREDENTIALS_SECRET. Hashing lets the operator supply a
 * passphrase of any length while keeping the key size AES-256 requires.
 */
const encryptionKey = (): Buffer => {
    const secret = process.env.PAYMENT_CREDENTIALS_SECRET?.trim();
    if (!secret) {
        throw new Error("PAYMENT_CREDENTIALS_SECRET is not configured; payment credentials cannot be stored securely.");
    }
    return createHash("sha256").update(secret).digest();
};

export const isSealed = (value: string): boolean => value.startsWith(PREFIX);

export const seal = (plaintext: string): string => {
    if (!plaintext) return "";
    if (isSealed(plaintext)) return plaintext;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
};

export const open = (sealed: string): string => {
    if (!sealed) return "";
    if (!isSealed(sealed)) return sealed;

    const payload = Buffer.from(sealed.slice(PREFIX.length), "base64");
    const iv = payload.subarray(0, IV_LENGTH);
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

/** Renders a stored secret as `sk_live_…4a2f` so the dashboard can show it without leaking it. */
export const maskSecret = (plaintext: string): string => {
    if (!plaintext) return "";
    if (plaintext.length <= 8) return "•".repeat(plaintext.length);

    const head = plaintext.slice(0, Math.min(8, plaintext.length - 4));
    const tail = plaintext.slice(-4);
    return `${head}…${tail}`;
};

/** True when the submitted value is a mask we produced, meaning "leave the stored secret alone". */
export const isMasked = (value: string): boolean => value.includes("…") || /^•+$/.test(value);

export const openAll = (sealed: Map<string, string> | Record<string, string> | undefined): Record<string, string> => {
    if (!sealed) return {};
    const entries = sealed instanceof Map ? [...sealed.entries()] : Object.entries(sealed);
    return Object.fromEntries(entries.map(([key, value]) => [key, open(value)]));
};
