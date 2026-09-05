import type { IncomingHttpHeaders } from "node:http";
import Stripe from "stripe";
import {
    gatewayNotConfiguredError,
    gatewayRejectedError,
    webhookSignatureInvalidError,
} from "../../shared/errors/PaymentError.js";
import type { HealthCheckResult, IPaymentGateway } from "../payment.interface.js";
import type {
    CheckoutContext,
    CheckoutResult,
    GatewayConfig,
    GatewayEvent,
    ProviderDescriptor,
} from "../payment.types.js";

const credential = (config: GatewayConfig, key: string, envKey: string): string =>
    (config.credentials[key] || process.env[envKey] || "").trim();

/** Stripe bills in the currency's smallest unit; these have no minor unit at all. */
const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

const toMinorUnits = (amount: number, currency: string): number => {
    const upper = currency.toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(upper)) return Math.round(amount);
    return Math.round(amount * 100);
};

const fromMinorUnits = (amount: number, currency: string): number => {
    const upper = currency.toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(upper)) return amount;
    return amount / 100;
};

const SUCCESS_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const FAILURE_EVENTS = new Set(["checkout.session.async_payment_failed"]);
const CANCEL_EVENTS = new Set(["checkout.session.expired"]);
const REFUND_EVENTS = new Set(["charge.refunded"]);

export class StripePaymentGateway implements IPaymentGateway {
    readonly provider = "stripe" as const;

    descriptor(): ProviderDescriptor {
        return {
            provider: "stripe",
            label: "Stripe",
            mode: "redirect",
            description: "Card, wallet, and bank payments through Stripe Checkout, settled automatically over webhooks.",
            credentialFields: [
                { key: "secretKey", label: "Secret key", type: "password", required: true, secret: true, placeholder: "sk_test_…", helpText: "Stripe dashboard → Developers → API keys." },
                { key: "publishableKey", label: "Publishable key", type: "text", required: false, placeholder: "pk_test_…" },
                { key: "webhookSecret", label: "Webhook signing secret", type: "password", required: true, secret: true, placeholder: "whsec_…", helpText: "From the endpoint you point at /api/webhooks/stripe." },
            ],
            settingFields: [
                { key: "statementDescriptor", label: "Statement descriptor", type: "text", required: false, placeholder: "VIZR AI", helpText: "Shown on the payer's bank statement (max 22 characters)." },
                { key: "collectBillingAddress", label: "Collect billing address", type: "boolean", required: false },
                { key: "allowPromotionCodes", label: "Allow promotion codes", type: "boolean", required: false },
            ],
            defaultPayerFields: [
                { key: "email", label: "Billing email", type: "email", required: true, placeholder: "you@company.com", order: 0 },
            ],
            supportedCurrencies: ["USD", "EUR", "GBP", "EGP", "AED", "SAR"],
            capabilities: { webhook: true, manualReview: false, healthCheck: true, recurring: true },
        };
    }

    validateConfig(config: GatewayConfig): void {
        if (!credential(config, "secretKey", "STRIPE_SECRET_KEY")) {
            throw gatewayNotConfiguredError("stripe", "A Stripe secret key is required before Stripe checkout can run.");
        }
    }

    async createCheckout(context: CheckoutContext): Promise<CheckoutResult> {
        this.validateConfig(context.config);
        const client = this.client(context.config);
        const { plan, billingCycle, amount, currency, reference, payer, config } = context;
        const settings = config.settings || {};

        try {
            const session = await client.checkout.sessions.create({
                mode: "payment",
                client_reference_id: reference,
                customer_email: payer.email || context.payerFields.email || undefined,
                success_url: context.successUrl,
                cancel_url: context.cancelUrl,
                allow_promotion_codes: settings.allowPromotionCodes ? true : undefined,
                billing_address_collection: settings.collectBillingAddress ? "required" : "auto",
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: currency.toLowerCase(),
                            unit_amount: toMinorUnits(amount, currency),
                            product_data: {
                                name: `${plan.name} — ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`,
                                description: plan.description || undefined,
                            },
                        },
                    },
                ],
                payment_intent_data: typeof settings.statementDescriptor === "string" && settings.statementDescriptor
                    ? { statement_descriptor: String(settings.statementDescriptor).slice(0, 22) }
                    : undefined,
                metadata: {
                    reference,
                    planId: plan.id,
                    planCode: plan.code,
                    billingCycle,
                    workspaceId: payer.workspaceId || "",
                    userId: payer.id || "",
                },
            });

            if (!session.url) {
                throw gatewayRejectedError("stripe", "Stripe did not return a checkout URL.");
            }

            return {
                mode: "redirect",
                status: "pending",
                redirectUrl: session.url,
                providerRef: session.id,
            };
        } catch (error) {
            if (error instanceof Stripe.errors.StripeError) {
                throw gatewayRejectedError("stripe", error.message, error.statusCode, error);
            }
            throw error;
        }
    }

    verifyWebhook(raw: Buffer, headers: IncomingHttpHeaders, config: GatewayConfig): GatewayEvent {
        const secret = credential(config, "webhookSecret", "STRIPE_WEBHOOK_SECRET");
        if (!secret) throw gatewayNotConfiguredError("stripe", "A Stripe webhook signing secret is required.");

        const signature = headers["stripe-signature"];
        if (typeof signature !== "string") throw webhookSignatureInvalidError("stripe");

        let event: Stripe.Event;
        try {
            event = this.client(config).webhooks.constructEvent(raw, signature, secret);
        } catch {
            throw webhookSignatureInvalidError("stripe");
        }

        return this.normalizeEvent(event);
    }

    async healthCheck(config: GatewayConfig): Promise<HealthCheckResult> {
        this.validateConfig(config);
        try {
            await this.client(config).balance.retrieve();
            return { ok: true, detail: "Connected to Stripe successfully." };
        } catch (error) {
            const message = error instanceof Stripe.errors.StripeError ? error.message : String(error);
            return { ok: false, detail: message };
        }
    }

    private client(config: GatewayConfig): Stripe {
        const secretKey = credential(config, "secretKey", "STRIPE_SECRET_KEY");
        if (!secretKey) throw gatewayNotConfiguredError("stripe");
        return new Stripe(secretKey, { typescript: true });
    }

    private normalizeEvent(event: Stripe.Event): GatewayEvent {
        if (SUCCESS_EVENTS.has(event.type)) {
            const session = event.data.object as Stripe.Checkout.Session;
            // An async method (bank debit) can complete unpaid; only `paid` settles the transaction.
            const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
            return {
                type: event.type,
                providerRef: session.id,
                status: paid ? "succeeded" : "ignored",
                amount: session.amount_total != null && session.currency
                    ? fromMinorUnits(session.amount_total, session.currency)
                    : undefined,
                currency: session.currency?.toUpperCase(),
                providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
                providerSubscriptionId: typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription?.id,
                raw: event,
            };
        }

        if (FAILURE_EVENTS.has(event.type)) {
            const session = event.data.object as Stripe.Checkout.Session;
            return {
                type: event.type,
                providerRef: session.id,
                status: "failed",
                failureReason: "Stripe reported the asynchronous payment as failed.",
                raw: event,
            };
        }

        if (CANCEL_EVENTS.has(event.type)) {
            const session = event.data.object as Stripe.Checkout.Session;
            return { type: event.type, providerRef: session.id, status: "cancelled", raw: event };
        }

        if (REFUND_EVENTS.has(event.type)) {
            const charge = event.data.object as Stripe.Charge;
            const providerRef = typeof charge.payment_intent === "string"
                ? charge.payment_intent
                : charge.payment_intent?.id || charge.id;
            return { type: event.type, providerRef, status: "refunded", raw: event };
        }

        return { type: event.type, providerRef: "", status: "ignored", raw: event };
    }
}
