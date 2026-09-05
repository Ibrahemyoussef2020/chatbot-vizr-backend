import HttpError from "./HttpError.js";

interface QuotaExceededErrorOptions {
    metric: string;
    limit: number;
    used: number;
    window: string;
    retryAfterSeconds: number;
    message?: string;
}

class QuotaExceededError extends HttpError {
    readonly metric: string;
    readonly limit: number;
    readonly used: number;
    readonly window: string;
    readonly retryAfterSeconds: number;

    constructor(options: QuotaExceededErrorOptions) {
        super({
            status: 429,
            message: options.message || `Plan limit reached for "${options.metric}" (${options.used}/${options.limit}).`,
        });

        this.name = "QuotaExceededError";
        this.metric = options.metric;
        this.limit = options.limit;
        this.used = options.used;
        this.window = options.window;
        this.retryAfterSeconds = options.retryAfterSeconds;
    }
}

export default QuotaExceededError;
