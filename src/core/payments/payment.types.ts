import type { IPayerField, PayerFieldType } from "../../models/PaymentMethodConfig.js";
import type { BillingCycle } from "../plans/plan.types.js";

export type PaymentProvider = "stripe" | "vodafone_cash";

export type CheckoutMode = "redirect" | "manual";

export type ManualDecision = "approve" | "reject";

/** Decrypted gateway configuration handed to a provider for a single operation. */
export interface GatewayConfig {
    provider: string;
    label: string;
    isEnabled: boolean;
    isTestMode: boolean;
    credentials: Record<string, string>;
    settings: Record<string, unknown>;
    payerFields: IPayerField[];
    supportedCurrencies: string[];
    instructions: string;
}

export interface CheckoutPlanSummary {
    id: string;
    code: string;
    name: string;
    description: string;
    trialDays: number;
}

export interface CheckoutPayer {
    id?: string;
    name?: string;
    email?: string;
    workspaceId?: string;
}

export interface CheckoutContext {
    plan: CheckoutPlanSummary;
    billingCycle: BillingCycle;
    amount: number;
    currency: string;
    reference: string;
    payer: CheckoutPayer;
    payerFields: Record<string, string>;
    config: GatewayConfig;
    successUrl: string;
    cancelUrl: string;
}

export interface CheckoutResult {
    mode: CheckoutMode;
    /** Terminal-ish status to persist on the transaction immediately after creation. */
    status: "pending" | "awaiting_review";
    redirectUrl?: string;
    providerRef?: string;
    instructions?: string;
    /** Values the provider normalized out of the raw payer submission. */
    payerFields?: Record<string, string>;
}

export interface GatewayEvent {
    type: string;
    providerRef: string;
    status: "succeeded" | "failed" | "refunded" | "cancelled" | "ignored";
    amount?: number;
    currency?: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    failureReason?: string;
    raw?: unknown;
}

export interface ConfigFieldDescriptor {
    key: string;
    label: string;
    type: "text" | "password" | "number" | "tel" | "email" | "textarea" | "boolean" | "select";
    required: boolean;
    /** Never returned in plaintext once stored. */
    secret?: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
    min?: number;
    max?: number;
}

export interface ProviderDescriptor {
    provider: PaymentProvider;
    label: string;
    mode: CheckoutMode;
    description: string;
    credentialFields: ConfigFieldDescriptor[];
    settingFields: ConfigFieldDescriptor[];
    defaultPayerFields: DefaultPayerField[];
    supportedCurrencies: string[];
    capabilities: {
        webhook: boolean;
        manualReview: boolean;
        healthCheck: boolean;
        recurring: boolean;
    };
}

export interface DefaultPayerField {
    key: string;
    label: string;
    type: PayerFieldType;
    required: boolean;
    placeholder?: string;
    pattern?: string;
    helpText?: string;
    order: number;
    options?: string[];
}
