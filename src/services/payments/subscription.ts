import { randomUUID } from "node:crypto";
import { PaymentGatewayFactory } from "../../core/payments/payment-gateway.factory.js";
import "../../core/payments/payment.strategies.js";
import type { GatewayConfig, PaymentProvider } from "../../core/payments/payment.types.js";
import { gatewayDisabledError } from "../../core/shared/errors/PaymentError.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import { PaymentMethodConfig, PaymentTransaction, Plan } from "../../models/index.js";

export interface SubscriptionInput {
    planCode: string;
    provider: PaymentProvider;
    billingCycle?: "monthly" | "yearly";
    email?: string;
    name?: string;
    payerFields?: Record<string, string>;
}

export const subscribeToPlan = async (input: SubscriptionInput) => {
    const planCode = input.planCode?.toLowerCase().trim();
    if (!planCode) {
        throw unprocessableEntityError("Plan code is required");
    }
    const provider = input.provider;
    if (!provider || !PaymentGatewayFactory.hasProvider(provider)) {
        throw unprocessableEntityError("Choose a supported payment provider.");
    }
    const billingCycle = input.billingCycle === "yearly" ? "yearly" : "monthly";
    const plan = await Plan.findOne({ code: planCode, status: "published", visibility: "public" }).exec();
    if (!plan) throw notFoundError("Published plan not found.");
    const price = plan.pricing[billingCycle];
    if (price == null || price <= 0) throw unprocessableEntityError(`The ${billingCycle} price is not configured for this plan.`);
    if (plan.allowedProviders.length && !plan.allowedProviders.includes(provider)) {
        throw unprocessableEntityError("This payment method is not available for the selected plan.");
    }

    const method = await PaymentMethodConfig.findOne({ provider, isEnabled: true }).exec();
    if (!method) throw gatewayDisabledError(provider);
    const descriptor = PaymentGatewayFactory.getProvider(provider).descriptor();
    const currency = plan.currency.toUpperCase();
    if (!method.supportedCurrencies.includes(currency) || !descriptor.supportedCurrencies.includes(currency)) {
        throw unprocessableEntityError(`${method.label} does not support ${currency} for this plan.`);
    }

    const settings = Object.fromEntries(method.settings);
    let amount = price;
    if (provider === "vodafone_cash") {
        const feePercent = Number(settings.feePercent || 0);
        const fixedFee = Number(settings.fixedFee || 0);
        amount = Math.round((price * (1 + feePercent / 100) + fixedFee) * 100) / 100;
    }
    const reference = `PAY-${randomUUID()}`;
    const gatewayConfig: GatewayConfig = {
        provider,
        label: method.label,
        isEnabled: method.isEnabled,
        isTestMode: method.isTestMode,
        credentials: Object.fromEntries(method.credentials),
        settings,
        payerFields: method.payerFields,
        supportedCurrencies: method.supportedCurrencies,
        instructions: method.instructions,
    };
    const gateway = PaymentGatewayFactory.getProvider(provider);
    gateway.validateConfig(gatewayConfig);
    const result = await gateway.createCheckout({
        plan: { id: String(plan._id), code: plan.code, name: plan.name, description: plan.description, trialDays: plan.trialDays },
        billingCycle,
        amount,
        currency,
        reference,
        payer: { email: input.email?.trim(), name: input.name?.trim() },
        payerFields: input.payerFields || {},
        config: gatewayConfig,
        successUrl: `${process.env.FRONTEND_URL || ""}/payment/success?reference=${encodeURIComponent(reference)}`,
        cancelUrl: `${process.env.FRONTEND_URL || ""}/payment/cancel?reference=${encodeURIComponent(reference)}`,
    });

    await PaymentTransaction.create({
        reference,
        planId: plan._id,
        planCode: plan.code,
        provider,
        billingCycle,
        amount,
        currency,
        status: result.status,
        providerRef: result.providerRef,
        payerEmail: input.email?.trim().toLowerCase() || "",
        payerName: input.name?.trim() || "",
        payerFields: result.payerFields || {},
    });

    return {
        success: true,
        message: `Checkout created for ${plan.name} (${billingCycle})`,
        checkout: {
            reference,
            provider,
            mode: result.mode,
            status: result.status,
            planCode,
            planName: plan.name,
            billingCycle,
            amount,
            currency,
            checkoutUrl: result.redirectUrl,
            instructions: result.instructions,
        },
    };
};
