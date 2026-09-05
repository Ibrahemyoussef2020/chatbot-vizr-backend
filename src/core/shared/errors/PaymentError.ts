import HttpError from "./HttpError.js";

export type PaymentErrorCode =
    | "GATEWAY_NOT_CONFIGURED"
    | "GATEWAY_DISABLED"
    | "GATEWAY_REJECTED"
    | "GATEWAY_UNSUPPORTED"
    | "WEBHOOK_SIGNATURE_INVALID"
    | "PAYMENT_PROOF_REQUIRED"
    | "DUPLICATE_TRANSACTION";

interface PaymentErrorOptions {
    code: PaymentErrorCode;
    message: string;
    status: number;
    retryable?: boolean;
    provider?: string;
    upstreamStatus?: number;
    cause?: unknown;
}

class PaymentError extends HttpError {
    readonly code: PaymentErrorCode;
    readonly retryable: boolean;
    readonly provider?: string;
    readonly upstreamStatus?: number;
    override readonly cause?: unknown;

    constructor(options: PaymentErrorOptions) {
        super({ status: options.status, message: options.message });
        this.name = "PaymentError";
        this.code = options.code;
        this.retryable = options.retryable ?? false;
        this.provider = options.provider;
        this.upstreamStatus = options.upstreamStatus;
        this.cause = options.cause;
    }
}

export const gatewayNotConfiguredError = (provider: string, detail?: string) => new PaymentError({
    code: "GATEWAY_NOT_CONFIGURED",
    message: detail || `The ${provider} payment method is not configured.`,
    status: 422,
    provider,
});

export const gatewayDisabledError = (provider: string) => new PaymentError({
    code: "GATEWAY_DISABLED",
    message: `The ${provider} payment method is currently disabled.`,
    status: 422,
    provider,
});

export const gatewayRejectedError = (provider: string, message: string, upstreamStatus?: number, cause?: unknown) => new PaymentError({
    code: "GATEWAY_REJECTED",
    message,
    status: 502,
    retryable: true,
    provider,
    upstreamStatus,
    cause,
});

export const gatewayUnsupportedError = (provider: string, capability: string) => new PaymentError({
    code: "GATEWAY_UNSUPPORTED",
    message: `The ${provider} payment method does not support ${capability}.`,
    status: 422,
    provider,
});

export const webhookSignatureInvalidError = (provider: string) => new PaymentError({
    code: "WEBHOOK_SIGNATURE_INVALID",
    message: `Invalid ${provider} webhook signature.`,
    status: 403,
    provider,
});

export const paymentProofRequiredError = (message = "Payment proof is required.") => new PaymentError({
    code: "PAYMENT_PROOF_REQUIRED",
    message,
    status: 422,
});

export const duplicateTransactionError = (message = "This transaction has already been recorded.") => new PaymentError({
    code: "DUPLICATE_TRANSACTION",
    message,
    status: 409,
});

export default PaymentError;
