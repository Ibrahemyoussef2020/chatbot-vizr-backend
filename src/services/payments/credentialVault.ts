import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const encryptionKey = () => {
    const source = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY
        || process.env.ACCESS_TOKEN_SECRET
        || process.env.JWT_SECRET
        || process.env.REFRESH_TOKEN_SECRET;
    if (!source) throw new Error("Configure PAYMENT_CREDENTIALS_ENCRYPTION_KEY or a JWT signing secret before saving workspace payment credentials.");
    return createHash("sha256").update(source).digest();
};

export const encryptCredential = (value: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["enc", "v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
};

export const decryptCredential = (value: string) => {
    if (!value.startsWith("enc:v1:")) return value;
    const [, , ivText, tagText, dataText] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
    decipher.setAuthTag(Buffer.from(tagText, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataText, "base64")), decipher.final()]).toString("utf8");
};

export const stripeCredentialEnvironment: Record<string, string> = {
    secretKey: "STRIPE_SECRET_KEY",
    publishableKey: "STRIPE_PUBLISHABLE_KEY",
    webhookSecret: "STRIPE_WEBHOOK_SECRET",
};
