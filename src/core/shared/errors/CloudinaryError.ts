import HttpError from "./HttpError.js";

export type CloudinaryErrorCode =
    | "CLOUDINARY_NOT_CONFIGURED"
    | "CLOUDINARY_NETWORK_ERROR"
    | "CLOUDINARY_ASSET_NOT_READY"
    | "CLOUDINARY_VERIFICATION_FAILED"
    | "CLOUDINARY_CLEANUP_FAILED";

interface CloudinaryErrorOptions {
    code: CloudinaryErrorCode;
    message: string;
    status: number;
    retryable: boolean;
    upstreamStatus?: number;
    cause?: unknown;
}

class CloudinaryError extends HttpError {
    readonly code: CloudinaryErrorCode;
    readonly retryable: boolean;
    readonly upstreamStatus?: number;
    override readonly cause?: unknown;

    constructor(options: CloudinaryErrorOptions) {
        super({ status: options.status, message: options.message });
        this.name = "CloudinaryError";
        this.code = options.code;
        this.retryable = options.retryable;
        this.upstreamStatus = options.upstreamStatus;
        this.cause = options.cause;
    }
}

export default CloudinaryError;
