import { createHash } from "node:crypto";
import { Types } from "mongoose";
import Plan from "../models/Plan.js";
import PaymentMethodConfig from "../models/PaymentMethodConfig.js";
import PaymentTransaction, { type TransactionStatus } from "../models/PaymentTransaction.js";
import Subscription from "../models/Subscription.js";
import Workspace from "../models/Workspace.js";
import "../core/payments/payment.strategies.js";
import { PaymentGatewayFactory } from "../core/payments/payment-gateway.factory.js";

const insertOptions = { upsert: true, timestamps: false, runValidators: true } as const;
const day = 86_400_000;

const seedId = (key: string) => {
    const hash = createHash("sha256").update(`payment-administration:v1:${key}`).digest("hex");
    return new Types.ObjectId(hash.slice(0, 24));
};

const dated = (data: Record<string, unknown>, date = new Date()) => ({
    ...data,
    createdAt: date,
    updatedAt: date,
});

const pricingDefinitions = [
    {
        code: "starter",
        name: "Starter",
        description: "Essential messaging and AI support for a small team.",
        pricing: { monthly: 29, yearly: 290 },
        trialDays: 14,
        features: ["Unified inbox", "AI customer support", "Knowledge base"],
    },
    {
        code: "launch",
        name: "Launch",
        description: "More channels and capacity for a growing business.",
        pricing: { monthly: 79, yearly: 790 },
        trialDays: 14,
        features: ["Unified inbox", "Team collaboration", "Conversation analytics"],
    },
    {
        code: "scale_pro",
        name: "Scale Pro",
        description: "Expanded capacity for teams operating across platforms.",
        pricing: { monthly: 199, yearly: 1990 },
        trialDays: 14,
        features: ["Team collaboration", "AI routing", "Business reporting"],
    },
    {
        code: "enterprise",
        name: "Enterprise",
        description: "High-volume support with additional team capacity.",
        pricing: { monthly: 499, yearly: 4990 },
        trialDays: 0,
        features: ["Custom implementation", "Dedicated onboarding", "Enterprise support"],
    },
];

export const seedPricings = async () => {
    let inserted = 0;
    for (const [sortOrder, definition] of pricingDefinitions.entries()) {
        const result = await Plan.updateOne(
            { code: definition.code },
            { $setOnInsert: dated({
                ...definition,
                status: "published",
                visibility: "public",
                currency: "USD",
                popular: definition.code === "scale_pro",
                sortOrder,
                overagePolicy: "block",
                entitlements: { human_takeover: true, custom_persona: true },
            }) },
            insertOptions,
        );
        inserted += result.upsertedCount;
    }
    return inserted;
};

export const seedPaymentMethods = async () => {
    let inserted = 0;
    for (const [sortOrder, descriptor] of PaymentGatewayFactory.listDescriptors().entries()) {
        const result = await PaymentMethodConfig.updateOne(
            { provider: descriptor.provider },
            { $setOnInsert: dated({
                provider: descriptor.provider,
                label: descriptor.label,
                isEnabled: false,
                isTestMode: true,
                sortOrder,
                credentials: {},
                settings: {},
                payerFields: descriptor.defaultPayerFields.map(field => ({ ...field, options: field.options || [] })),
                supportedCurrencies: descriptor.supportedCurrencies,
                instructions: "Configure this provider before enabling payments.",
            }) },
            insertOptions,
        );
        inserted += result.upsertedCount;
    }
    return inserted;
};

interface SeedWorkspace {
    _id: Types.ObjectId;
    slug: string;
}

const samplePlan = async () => {
    const plan = await Plan.findOne({ code: "starter" }).exec();
    if (!plan) throw new Error("Seed pricings before payment and subscription samples.");
    return plan;
};

export const seedPayments = async (workspaces: SeedWorkspace[]) => {
    const plan = await samplePlan();
    const statuses: TransactionStatus[] = ["pending", "awaiting_review", "succeeded", "failed", "refunded", "cancelled"];
    let inserted = 0;
    for (const workspace of workspaces) {
        for (const [index, status] of statuses.entries()) {
            const reference = `SEED-PAYMENT-V1-${workspace._id}-${status}`;
            const result = await PaymentTransaction.updateOne(
                { reference },
                { $setOnInsert: dated({
                    _id: seedId(reference),
                    reference,
                    workspaceId: workspace._id,
                    planId: plan._id,
                    planCode: plan.code,
                    provider: status === "awaiting_review" ? "vodafone_cash" : "stripe",
                    providerRef: `seed:${reference}`,
                    billingCycle: "monthly",
                    amount: plan.pricing.monthly ?? 0,
                    currency: plan.currency,
                    status,
                    payerName: `Sample payer (${workspace.slug})`,
                    payerEmail: `sample-${index}@example.test`,
                    reviewNote: "Seed sample only. No payment was processed.",
                    failureReason: status === "failed" ? "Sample declined payment." : "",
                    rawEvent: { source: "payment-administration-seed", version: 1 },
                }, new Date(Date.now() - (index + 1) * day)) },
                insertOptions,
            );
            inserted += result.upsertedCount;
        }
    }
    return inserted;
};

export const seedSubscriptions = async (workspaces: SeedWorkspace[]) => {
    const plan = await samplePlan();
    let inserted = 0;
    for (const workspace of workspaces) {
        for (const status of ["expired", "canceled"] as const) {
            const reference = `SEED-SUBSCRIPTION-V1-${workspace._id}-${status}`;
            const periodStart = new Date(Date.now() - 120 * day);
            const periodEnd = new Date(Date.now() - 90 * day);
            const result = await Subscription.updateOne(
                { _id: seedId(reference) },
                { $setOnInsert: dated({
                    workspaceId: workspace._id,
                    planId: plan._id,
                    planCode: plan.code,
                    status,
                    provider: "seed",
                    providerSubscriptionId: reference,
                    billingCycle: "monthly",
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                    canceledAt: status === "canceled" ? periodEnd : null,
                }, periodStart) },
                insertOptions,
            );
            inserted += result.upsertedCount;
        }
    }
    return inserted;
};

export const seedPaymentAdministration = async (slugs: string[]) => {
    const uniqueSlugs = [...new Set(slugs)];
    if (!uniqueSlugs.length) throw new Error("Select at least one workspace for sample records.");
    const workspaces = await Workspace.find({ slug: { $in: uniqueSlugs } }).select("_id slug").lean().exec();
    const missing = uniqueSlugs.filter(slug => !workspaces.some(workspace => workspace.slug === slug));
    if (missing.length) throw new Error(`Unknown workspaces: ${missing.join(", ")}`);

    const pricings = await seedPricings();
    const paymentMethods = await seedPaymentMethods();
    const payments = await seedPayments(workspaces);
    const subscriptions = await seedSubscriptions(workspaces);
    return { inserted: { pricings, paymentMethods, payments, subscriptions }, workspaces: uniqueSlugs };
};
