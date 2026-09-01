import { createHash } from "node:crypto";
import { internalServerError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || parsed?.hostname;
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || (parsed?.username ? decodeURIComponent(parsed.username) : undefined);
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || (parsed?.password ? decodeURIComponent(parsed.password) : undefined);
    if (!cloudName || !apiKey || !apiSecret) throw internalServerError("Cloudinary is not configured.");
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
    const parameters = { overwrite: false, public_id: publicId, timestamp, unique_filename: false };
    return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        apiKey,
        timestamp,
        signature: signCloudinaryParameters(parameters),
        parameters,
    };
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
            lastError = new Error(`Cloudinary temporarily returned ${response.status}`);
        } catch (error) {
            lastError = error;
            if (attempt === retries) break;
        }
        await sleep(retryDelayMs(attempt));
    }
    throw internalServerError(`Cloudinary is temporarily unavailable: ${lastError instanceof Error ? lastError.message : "network error"}`);
};

export const verifyCloudinaryAsset = async (resourceType: CloudinaryResourceType, publicId: string) => {
    const response = await authenticatedRequest(`/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`);
    if (response.status === 404) throw unprocessableEntityError("Cloudinary has not completed this upload.");
    if (!response.ok) throw internalServerError(`Cloudinary verification failed with status ${response.status}.`);
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
    if (!response.ok && response.status !== 404) throw internalServerError(`Cloudinary cleanup failed with status ${response.status}.`);
};
