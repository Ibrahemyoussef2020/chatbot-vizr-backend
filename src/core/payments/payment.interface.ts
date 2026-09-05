import type { IncomingHttpHeaders } from "node:http";
import type { IPaymentTransaction } from "../../models/PaymentTransaction.js";
import type {
    CheckoutContext,
    CheckoutResult,
    GatewayConfig,
    GatewayEvent,
    ManualDecision,
    PaymentProvider,
    ProviderDescriptor,
} from "./payment.types.js";

export interface HealthCheckResult {
    ok: boolean;
    detail?: string;
}

export interface IPaymentGateway {
    readonly provider: PaymentProvider;

    /** Field schema the dashboard renders its configuration form from. */
    descriptor(): ProviderDescriptor;

    /** Throws a PaymentError when the stored configuration cannot transact. */
    validateConfig(config: GatewayConfig): void;

    createCheckout(context: CheckoutContext): Promise<CheckoutResult>;

    /** Redirect gateways only: verify the signature and normalize the event. */
    verifyWebhook?(raw: Buffer, headers: IncomingHttpHeaders, config: GatewayConfig): GatewayEvent;

    /** Manual gateways only: settle a transaction the owner reviewed by hand. */
    confirmManual?(transaction: IPaymentTransaction, decision: ManualDecision, config: GatewayConfig): Promise<GatewayEvent>;

    healthCheck?(config: GatewayConfig): Promise<HealthCheckResult>;
}
