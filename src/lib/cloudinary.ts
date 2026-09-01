import { createHash, timingSafeEqual } from "node:crypto";
import { extname } from "node:path";
import CloudinaryError from "../core/shared/errors/CloudinaryError.js";
import { isTransientUploadStatus, retryDelayMs } from "../core/knowledge/upload-policy.js";

export type CloudinaryResourceType = "raw" | "video";

interface CloudinaryConfig {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
}

export interface CloudinaryAsset {
    asset_id: string;
    public_id: string;
    resource_type: CloudinaryResourceType;
    bytes: number;
    secure_url: string;
    version: number;
}

const config = (): CloudinaryConfig => {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
    const parsed = cloudinaryUrl ? new URL(cloudinaryUrl) : undefined;
    const cloudName = process.env.CLOUDINARY_NAME?.trim() || parsed?.hostname;
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || (parsed?.username ? decodeURIComponent(parsed.username) : undefined);
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || (parsed?.password ? decodeURIComponent(parsed.password) : undefined);
    if (!cloudName || !apiKey || !apiSecret) {
        const missing = [
            !cloudName && "CLOUDINARY_NAME",
            !apiKey && "CLOUDINARY_API_KEY",
            !apiSecret && "CLOUDINARY_API_SECRET",
        ].filter(Boolean).join(", ");
        throw new CloudinaryError({
            code: "CLOUDINARY_NOT_CONFIGURED",
            message: `Cloudinary is not configured. Missing: ${missing}.`,
            status: 500,
            retryable: false,
        });
    }
    return { cloudName, apiKey, apiSecret };
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const signCloudinaryParameters = (parameters: Record<string, string | number | boolean>) => {
    const { apiSecret } = config();
    const payload = Object.entries(parameters)
        .filter(([, value]) => value !== "" && value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
    return createHash("sha256").update(`${payload}${apiSecret}`).digest("hex");
};

export const createDirectUploadAuthorization = (publicId: string, resourceType: CloudinaryResourceType) => {
    const { cloudName, apiKey } = config();
    const timestamp = Math.floor(Date.now() / 1000);
    const notificationUrl = process.env.CLOUDINARY_NOTIFICATION_URL?.trim()
        || `${(process.env.SERVER_URL || "").replace(/\/$/, "")}/api/webhooks/cloudinary`;
    if (!notificationUrl.startsWith("https://")) {
        throw new CloudinaryError({ code: "CLOUDINARY_NOT_CONFIGURED", message: "A secure Cloudinary notification URL is required.", status: 500, retryable: false });
    }
    const parameters = { notification_url: notificationUrl, overwrite: false, public_id: publicId, timestamp, unique_filename: false };
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        apiKey,
        timestamp,
        signature: signCloudinaryParameters(parameters),
        parameters,
    };
};

export const verifyCloudinaryNotification = (rawBody: Buffer, signature?: string, timestamp?: string) => {
    if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (ageSeconds > 2 * 60 * 60) return false;
    const { apiSecret } = config();
    const algorithm = signature.length === 64 ? "sha256" : "sha1";
    const expected = createHash(algorithm).update(rawBody).update(timestamp).update(apiSecret).digest("hex");
    const receivedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
};

const authenticatedRequest = async (path: string, init: RequestInit = {}, retries = 3): Promise<Response> => {
    const { cloudName, apiKey, apiSecret } = config();
    const authorization = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}${path}`, {
                ...init,
                headers: { Authorization: `Basic ${authorization}`, ...init.headers },
                signal: AbortSignal.timeout(15_000),
            });
            if (!isTransientUploadStatus(response.status) || attempt === retries) return response;
            lastError = new CloudinaryError({
                code: "CLOUDINARY_NETWORK_ERROR",
                message: `Cloudinary temporarily returned ${response.status}.`,
                status: 503,
                retryable: true,
                upstreamStatus: response.status,
            });
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
        }
        await sleep(retryDelayMs(attempt));
    }
    throw new CloudinaryError({
        code: "CLOUDINARY_NETWORK_ERROR",
        message: `Cloudinary is temporarily unavailable: ${lastError instanceof Error ? lastError.message : "network error"}`,
        status: 503,
        retryable: true,
        cause: lastError,
    });
};

export const verifyCloudinaryAsset = async (resourceType: CloudinaryResourceType, publicId: string, fileName?: string) => {
    const rawExtension = resourceType === "raw" ? extname(fileName || "").toLowerCase() : "";
    const candidates = [publicId, rawExtension && !publicId.endsWith(rawExtension) ? `${publicId}${rawExtension}` : ""].filter(Boolean);
    let response: Response | undefined;
    for (const candidate of candidates) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            response = await authenticatedRequest(`/resources/${resourceType}/upload/${encodeURIComponent(candidate)}`);
            if (response.status !== 404) break;
            if (attempt < 4) await sleep(retryDelayMs(attempt));
        }
        if (response?.status !== 404) break;
    }
    if (!response || response.status === 404) {
        throw new CloudinaryError({ code: "CLOUDINARY_ASSET_NOT_READY", message: "Cloudinary is still finalizing this upload. Retry completion shortly.", status: 503, retryable: true, upstreamStatus: 404 });
    }
    if (!response.ok) {
        throw new CloudinaryError({ code: "CLOUDINARY_VERIFICATION_FAILED", message: `Cloudinary verification failed with status ${response.status}.`, status: 502, retryable: false, upstreamStatus: response.status });
    }
    return await response.json() as CloudinaryAsset;
};

export const destroyCloudinaryAsset = async (resourceType: CloudinaryResourceType, publicId: string) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinaryParameters({ public_id: publicId, timestamp });
    const { apiKey, cloudName } = config();
    const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 404) {
        throw new CloudinaryError({ code: "CLOUDINARY_CLEANUP_FAILED", message: `Cloudinary cleanup failed with status ${response.status}.`, status: 502, retryable: isTransientUploadStatus(response.status), upstreamStatus: response.status });
    }
};
