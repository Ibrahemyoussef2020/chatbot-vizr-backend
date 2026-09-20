import type { IncomingHttpHeaders } from "node:http";
import "../../core/payments/payment.strategies.js";
import { PaymentGatewayFactory } from "../../core/payments/payment-gateway.factory.js";
import type { GatewayConfig } from "../../core/payments/payment.types.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import { PaymentTransaction, Subscription } from "../../models/index.js";
import { getEffectivePaymentMethodConfig } from "./paymentMethodConfig.js";

export const handleStripeWebhook = async (rawBody: Buffer, headers: IncomingHttpHeaders) => {
    let rawEvent: Record<string, any> = {};
    try { rawEvent = JSON.parse(rawBody.toString("utf8")); } catch { /* Signature verification below reports invalid input. */ }
    const object = rawEvent.data?.object || {};
    const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id;
    const reference = object.metadata?.reference || object.client_reference_id;
    let transaction = reference
        ? await PaymentTransaction.findOne({ provider: "stripe", reference }).exec()
        : null;
    if (!transaction && object.id) transaction = await PaymentTransaction.findOne({ provider: "stripe", providerRef: object.id }).exec();
    if (!transaction && paymentIntentId) transaction = await PaymentTransaction.findOne({ provider: "stripe", paymentIntentId }).exec();
    const workspaceId = transaction?.workspaceId ? String(transaction.workspaceId) : object.metadata?.workspaceId;
    const method = await getEffectivePaymentMethodConfig("stripe", workspaceId);
    if (!method) throw notFoundError("Stripe payments are not configured for this workspace.");

    const config: GatewayConfig = {
        provider: "stripe",
        label: method.label,
        isEnabled: method.isEnabled,
        isTestMode: method.isTestMode,
        credentials: method.credentials,
        settings: method.settings,
        payerFields: method.payerFields,
        supportedCurrencies: method.supportedCurrencies,
        instructions: method.instructions,
    };
    const event = PaymentGatewayFactory.getProvider("stripe").verifyWebhook?.(rawBody, headers, config);
    if (!event) throw unprocessableEntityError("Stripe webhook verification is unavailable.");
    if (!event.providerRef || event.status === "ignored") return { received: true, ignored: true };

    transaction ||= await PaymentTransaction.findOne({ provider: "stripe", providerRef: event.providerRef }).exec();
    if (!transaction && event.paymentIntentId) transaction = await PaymentTransaction.findOne({ provider: "stripe", paymentIntentId: event.paymentIntentId }).exec();
    if (!transaction && event.status === "refunded") transaction = await PaymentTransaction.findOne({ provider: "stripe", paymentIntentId: event.providerRef }).exec();
    if (!transaction) throw notFoundError("No payment matches this Stripe checkout session.");
    if (event.amount !== undefined && Math.abs(event.amount - transaction.amount) > 0.01) {
        throw unprocessableEntityError("Stripe payment amount does not match the checkout transaction.");
    }
    if (event.currency && event.currency !== transaction.currency.toUpperCase()) {
        throw unprocessableEntityError("Stripe payment currency does not match the checkout transaction.");
    }
    if (transaction.status === "succeeded" && event.status === "succeeded") return { received: true, duplicate: true };

    transaction.status = event.status === "succeeded" || event.status === "failed" || event.status === "cancelled" || event.status === "refunded"
        ? event.status
        : transaction.status;
    transaction.providerRef = event.providerRef;
    transaction.paymentIntentId = event.paymentIntentId || transaction.paymentIntentId;
    transaction.failureReason = event.failureReason || transaction.failureReason;
    transaction.rawEvent = event.raw;
    await transaction.save();

    if (event.status === "succeeded" && transaction.workspaceId) {
        const start = new Date();
        const end = new Date(start);
        if (transaction.billingCycle === "yearly") end.setFullYear(end.getFullYear() + 1);
        else end.setMonth(end.getMonth() + 1);

        await Subscription.findOneAndUpdate(
            { workspaceId: transaction.workspaceId, status: { $in: ["trialing", "active", "past_due"] } },
            {
                $set: {
                    planId: transaction.planId,
                    planCode: transaction.planCode,
                    status: "active",
                    billingCycle: transaction.billingCycle,
                    currentPeriodStart: start,
                    currentPeriodEnd: end,
                    provider: "stripe",
                    providerCustomerId: event.providerCustomerId || "",
                    providerSubscriptionId: event.providerSubscriptionId || "",
                    cancelAtPeriodEnd: false,
                },
                $setOnInsert: { workspaceId: transaction.workspaceId },
            },
            { upsert: true, new: true, runValidators: true },
        ).exec();
    }

    return { received: true, status: transaction.status };
};
