import { unprocessableEntityError } from "../shared/errors/HttpError.js";

export const isTransientUploadStatus = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

export const retryDelayMs = (attempt: number, random = Math.random()) => Math.min(
    500 * (2 ** Math.max(0, attempt)) + random * 250,
    10_000,
);

export const validateUploadDescriptor = (name: string, size: number, maximumBytes: number) => {
    if (!name.trim() || !Number.isSafeInteger(size) || size <= 0) throw unprocessableEntityError("Invalid file metadata.");
    if (size > maximumBytes) throw unprocessableEntityError(`File exceeds the ${Math.floor(maximumBytes / 1024 / 1024)} MB upload limit.`);
};

export const duplicateDisposition = (status?: string) => {
    if (status === "COMPLETED") return "duplicate" as const;
    if (status === "INITIATED" || status === "UPLOADING") return "resume" as const;
    return "replace" as const;
};

export const runWithUploadRetry = async <T>(
    operation: (attempt: number) => Promise<T>,
    options: { retries?: number; signal?: AbortSignal; shouldRetry?: (error: unknown) => boolean; pause?: (milliseconds: number) => Promise<void> } = {},
) => {
    const retries = options.retries ?? 3;
    for (let attempt = 0; ; attempt += 1) {
        options.signal?.throwIfAborted();
        try {
            return await operation(attempt);
        } catch (error) {
            if (attempt >= retries || options.signal?.aborted || !(options.shouldRetry?.(error) ?? true)) throw error;
            await (options.pause || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))))(retryDelayMs(attempt));
        }
    }
};
