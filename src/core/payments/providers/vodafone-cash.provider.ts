import type { IPaymentTransaction } from "../../../models/PaymentTransaction.js";
import { gatewayNotConfiguredError, paymentProofRequiredError } from "../../shared/errors/PaymentError.js";
import { unprocessableEntityError } from "../../shared/errors/HttpError.js";
import type { HealthCheckResult, IPaymentGateway } from "../payment.interface.js";
import type {
    CheckoutContext,
    CheckoutResult,
    GatewayConfig,
    GatewayEvent,
    ManualDecision,
    ProviderDescriptor,
} from "../payment.types.js";

const EGYPTIAN_WALLET = /^(?:\+?20)?1[0125]\d{8}$/;

const setting = (config: GatewayConfig, key: string): unknown => config.settings?.[key];

const numericSetting = (config: GatewayConfig, key: string): number | undefined => {
    const value = setting(config, key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

export class VodafoneCashPaymentGateway implements IPaymentGateway {
    readonly provider = "vodafone_cash" as const;

    descriptor(): ProviderDescriptor {
        return {
            provider: "vodafone_cash",
            label: "Vodafone Cash",
            mode: "manual",
            description: "Wallet-to-wallet transfer. The payer sends the amount and submits a reference, then the business owner approves it.",
            credentialFields: [],
            settingFields: [
                { key: "walletNumber", label: "Receiving wallet number", type: "tel", required: true, placeholder: "01012345678", helpText: "The Vodafone Cash number payers transfer to." },
                { key: "holderName", label: "Wallet holder name", type: "text", required: true, placeholder: "Vizr AI" },
                { key: "minAmount", label: "Minimum amount", type: "number", required: false, min: 0, helpText: "Reject transfers below this amount. Leave blank for no floor." },
                { key: "maxAmount", label: "Maximum amount", type: "number", required: false, min: 0, helpText: "Reject transfers above this amount. Leave blank for no ceiling." },
                { key: "feePercent", label: "Transfer fee (%)", type: "number", required: false, min: 0, max: 100, helpText: "Added to the plan price at checkout." },
                { key: "fixedFee", label: "Fixed fee", type: "number", required: false, min: 0, helpText: "Flat surcharge added to the plan price." },
                { key: "reviewSlaHours", label: "Review SLA (hours)", type: "number", required: false, min: 1, helpText: "Shown to the payer as the expected confirmation window." },
            ],
            defaultPayerFields: [
                { key: "senderNumber", label: "Your wallet number", type: "tel", required: true, placeholder: "01012345678", pattern: EGYPTIAN_WALLET.source, helpText: "The number you transferred from.", order: 0 },
                { key: "senderName", label: "Sender name", type: "text", required: true, placeholder: "As registered on the wallet", order: 1 },
                { key: "transactionReference", label: "Transaction reference", type: "text", required: true, placeholder: "From the Vodafone Cash SMS", helpText: "The reference in the confirmation SMS.", order: 2 },
                { key: "transferDate", label: "Transfer date", type: "date", required: true, order: 3 },
                { key: "proof", label: "Transfer receipt", type: "file", required: false, helpText: "A screenshot of the confirmation SMS speeds up review.", order: 4 },
            ],
            supportedCurrencies: ["EGP", "USD"],
            capabilities: { webhook: false, manualReview: true, healthCheck: false, recurring: false },
        };
    }

    validateConfig(config: GatewayConfig): void {
        const wallet = String(setting(config, "walletNumber") || "").replace(/[\s-]/g, "");
        if (!wallet) {
            throw gatewayNotConfiguredError("vodafone_cash", "A receiving Vodafone Cash wallet number is required.");
        }
        if (!EGYPTIAN_WALLET.test(wallet)) {
            throw gatewayNotConfiguredError("vodafone_cash", "The receiving wallet number is not a valid Egyptian mobile number.");
        }
        if (!String(setting(config, "holderName") || "").trim()) {
            throw gatewayNotConfiguredError("vodafone_cash", "A wallet holder name is required so payers know who they are paying.");
        }
    }

    async createCheckout(context: CheckoutContext): Promise<CheckoutResult> {
        const { config, amount, currency, reference, plan, billingCycle } = context;
        this.validateConfig(config);

        const min = numericSetting(config, "minAmount");
        const max = numericSetting(config, "maxAmount");
        if (min != null && amount < min) {
            throw unprocessableEntityError(`Vodafone Cash transfers must be at least ${min} ${currency}.`);
        }
        if (max != null && max > 0 && amount > max) {
            throw unprocessableEntityError(`Vodafone Cash transfers may not exceed ${max} ${currency}. Please choose another payment method.`);
        }

        const payerFields = this.collectPayerFields(context);
        const wallet = String(setting(config, "walletNumber"));
        const holder = String(setting(config, "holderName"));
        const slaHours = numericSetting(config, "reviewSlaHours") ?? 24;

        const instructions = [
            config.instructions?.trim(),
            `Transfer ${amount.toFixed(2)} ${currency} to Vodafone Cash number ${wallet} (${holder}).`,
            `Use reference ${reference} so we can match your payment to the ${plan.name} ${billingCycle} plan.`,
            `We confirm transfers within ${slaHours} hour${slaHours === 1 ? "" : "s"}; your subscription activates on approval.`,
        ].filter(Boolean).join("\n");

        return {
            mode: "manual",
            status: "awaiting_review",
            instructions,
            payerFields,
        };
    }

    async confirmManual(
        transaction: IPaymentTransaction,
        decision: ManualDecision,
    ): Promise<GatewayEvent> {
        const approved = decision === "approve";

        return {
            type: approved ? "vodafone_cash.approved" : "vodafone_cash.rejected",
            providerRef: transaction.providerRef || transaction.reference,
            status: approved ? "succeeded" : "failed",
            amount: transaction.amount,
            currency: transaction.currency,
            failureReason: approved ? undefined : "The business owner rejected this Vodafone Cash transfer.",
        };
    }

    async healthCheck(config: GatewayConfig): Promise<HealthCheckResult> {
        try {
            this.validateConfig(config);
            return {
                ok: true,
                detail: `Ready to receive transfers at ${setting(config, "walletNumber")}.`,
            };
        } catch (error) {
            return { ok: false, detail: error instanceof Error ? error.message : String(error) };
        }
    }

    /**
     * Validates the payer submission against the owner-configured field schema, falling back to
     * the provider defaults when the owner has not customized it.
     */
    private collectPayerFields(context: CheckoutContext): Record<string, string> {
        const schema = context.config.payerFields?.length
            ? [...context.config.payerFields].sort((a, b) => a.order - b.order)
            : this.descriptor().defaultPayerFields.map((field) => ({ ...field, options: field.options || [] }));

        const submitted = context.payerFields || {};
        const collected: Record<string, string> = {};

        for (const field of schema) {
            const raw = submitted[field.key];
            const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

            if (!value) {
                if (!field.required) continue;
                if (field.type === "file") throw paymentProofRequiredError(`"${field.label}" is required.`);
                throw unprocessableEntityError(`"${field.label}" is required to submit a Vodafone Cash transfer.`);
            }

            if (field.pattern) {
                let matches = true;
                try {
                    matches = new RegExp(field.pattern).test(value);
                } catch {
                    // A malformed owner-supplied pattern must not block a payer.
                    matches = true;
                }
                if (!matches) throw unprocessableEntityError(`"${field.label}" is not in the expected format.`);
            }

            if (field.type === "number" && !Number.isFinite(Number(value))) {
                throw unprocessableEntityError(`"${field.label}" must be a number.`);
            }

            if (field.type === "select" && field.options?.length && !field.options.includes(value)) {
                throw unprocessableEntityError(`"${field.label}" must be one of: ${field.options.join(", ")}.`);
            }

            collected[field.key] = value;
        }

        return collected;
    }
}
