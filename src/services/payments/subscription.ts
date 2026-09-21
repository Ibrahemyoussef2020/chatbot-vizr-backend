import { randomUUID } from "node:crypto";
import { PaymentGatewayFactory } from "../../core/payments/payment-gateway.factory.js";
import "../../core/payments/payment.strategies.js";
import type { GatewayConfig, PaymentProvider } from "../../core/payments/payment.types.js";
import { gatewayDisabledError } from "../../core/shared/errors/PaymentError.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import { PaymentTransaction, Plan, Subscription, Workspace } from "../../models/index.js";
import { getEffectivePaymentMethodConfig, resolveWorkspaceForPayment } from "./paymentMethodConfig.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";

export interface SubscriptionInput {
    planCode: string;
    provider: PaymentProvider;
    billingCycle?: "monthly" | "yearly";
    email?: string;
    name?: string;
    payerFields?: Record<string, string>;
    workspaceSlug?: string;
}

export const subscribeToPlan = async (input: SubscriptionInput, user?: AuthenticatedUserContext) => {
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
    const subscriptionWorkspaceId = user ? await resolveWorkspaceForPayment(user, input.workspaceSlug) : undefined;
    if (user && (!subscriptionWorkspaceId || user.role === "super_admin")) throw unprocessableEntityError("A customer workspace is required to start a subscription.");
    const price = plan.pricing[billingCycle];
    if (price == null || price <= 0) throw unprocessableEntityError(`The ${billingCycle} price is not configured for this plan.`);
    if (plan.allowedProviders.length && !plan.allowedProviders.includes(provider)) {
        throw unprocessableEntityError("This payment method is not available for the selected plan.");
    }

    const method = await getEffectivePaymentMethodConfig(provider, subscriptionWorkspaceId);
    if (!method?.isEnabled) throw gatewayDisabledError(provider);
    const descriptor = PaymentGatewayFactory.getProvider(provider).descriptor();
    const currency = plan.currency.toUpperCase();
    if (!method.supportedCurrencies.includes(currency) || !descriptor.supportedCurrencies.includes(currency)) {
        throw unprocessableEntityError(`${method.label} does not support ${currency} for this plan.`);
    }

    const settings = method.settings;
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
        credentials: method.credentials,
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
        payer: {
            id: user?.id,
            workspaceId: subscriptionWorkspaceId,
            email: input.email?.trim() || user?.email,
            name: input.name?.trim() || user?.name,
        },
        payerFields: input.payerFields || {},
        config: gatewayConfig,
        successUrl: `${process.env.FRONTEND_URL || ""}/payment/success?reference=${encodeURIComponent(reference)}`,
        cancelUrl: `${process.env.FRONTEND_URL || ""}/payment/cancel?reference=${encodeURIComponent(reference)}`,
    });

    await PaymentTransaction.create({
        reference,
        ...(user ? { userId: user.id, workspaceId: subscriptionWorkspaceId } : {}),
        planId: plan._id,
        planCode: plan.code,
        provider,
        billingCycle,
        amount,
        currency,
        status: result.status,
        providerRef: result.providerRef,
        payerEmail: input.email?.trim().toLowerCase() || user?.email || "",
        payerName: input.name?.trim() || user?.name || "",
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

export const startFreeSubscription = async (
    user: AuthenticatedUserContext,
    planCode: string,
    billingCycle: "monthly" | "yearly" = "monthly",
) => {
    if (!user.workspaceId || user.role === "super_admin") {
        throw unprocessableEntityError("A customer workspace is required to start a plan.");
    }
    const workspace = await Workspace.findOne({ _id: user.workspaceId, ownerId: user.id }).exec();
    if (!workspace) throw notFoundError("Workspace not found.");
    const plan = await Plan.findOne({ code: planCode.trim().toLowerCase(), status: "published", visibility: "public" }).exec();
    if (!plan) throw notFoundError("Published plan not found.");
    if (plan.pricing[billingCycle] !== 0) throw unprocessableEntityError("This plan is not free for the selected billing cycle.");

    const start = new Date();
    const end = new Date(start);
    if (billingCycle === "yearly") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    const subscription = await Subscription.findOneAndUpdate(
        { workspaceId: workspace._id, status: { $in: ["trialing", "active", "past_due"] } },
        {
            $set: {
                planId: plan._id,
                planCode: plan.code,
                status: "active",
                billingCycle,
                currentPeriodStart: start,
                currentPeriodEnd: end,
                provider: "free",
                cancelAtPeriodEnd: false,
            },
            $setOnInsert: { workspaceId: workspace._id },
        },
        { upsert: true, new: true, runValidators: true },
    ).exec();

    return { planCode: plan.code, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd };
};

export const getWorkspaceSubscriptionStatus = async (user: AuthenticatedUserContext) => {
    if (!user.workspaceId || user.role === "super_admin") {
        return { active: false, pending: false, planCode: null, paymentStatus: null };
    }
    const workspace = await Workspace.findById(user.workspaceId).select("selectedPlanCode").lean().exec();
    if (!workspace?.selectedPlanCode) return { active: false, pending: false, planCode: null, paymentStatus: null };
    const subscription = await Subscription.findOne({
        workspaceId: user.workspaceId,
        status: { $in: ["trialing", "active"] },
        currentPeriodEnd: { $gt: new Date() },
    }).select("planCode status currentPeriodEnd").lean().exec();
    const matchesSelectedPlan = subscription?.planCode === workspace.selectedPlanCode;
    if (matchesSelectedPlan) {
        return {
            active: true,
            pending: false,
            planCode: subscription.planCode,
            status: subscription.status,
            paymentStatus: null,
            currentPeriodEnd: subscription.currentPeriodEnd,
        };
    }
    const pendingPayment = await PaymentTransaction.findOne({
        workspaceId: user.workspaceId,
        planCode: workspace.selectedPlanCode,
        status: { $in: ["pending", "awaiting_review", "succeeded"] },
    }).sort({ createdAt: -1 }).select("planCode status provider reference createdAt").lean().exec();
    const isPending = Boolean(pendingPayment);
    return {
        active: false,
        pending: isPending,
        planCode: isPending ? pendingPayment?.planCode || null : null,
        status: isPending ? "pending_payment" : null,
        paymentStatus: isPending ? pendingPayment?.status || null : null,
        paymentProvider: isPending ? pendingPayment?.provider || null : null,
        paymentReference: isPending ? pendingPayment?.reference || null : null,
    };
};
