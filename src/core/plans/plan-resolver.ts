import type { IPlan } from "../../models/Plan.js";
import type { ISubscription } from "../../models/Subscription.js";
import type { PlanEntitlements, PlanQuotas, ResolvedPlanAccess } from "./plan.types.js";
import { entitlementKeys, freePlanQuotas, isQuotaMetric, quotaRegistry } from "./quota.registry.js";

const toRecord = <TValue>(source: Map<string, TValue> | Record<string, TValue> | undefined): Record<string, TValue> => {
    if (!source) return {};
    return source instanceof Map ? Object.fromEntries(source) : { ...source };
};

/** Registry defaults, so a plan that omits a metric still resolves to a concrete number. */
const registryDefaults = (): PlanQuotas => Object.fromEntries(quotaRegistry.map((item) => [item.key, item.defaultLimit]));

const emptyEntitlements = (): PlanEntitlements => Object.fromEntries(entitlementKeys.map((key) => [key, false]));

export const FREE_PLAN_FALLBACK: ResolvedPlanAccess = {
    planId: null,
    planCode: "free",
    planName: "Free",
    status: "none",
    billingCycle: null,
    currentPeriodEnd: null,
    quotas: { ...freePlanQuotas },
    entitlements: emptyEntitlements(),
    overagePolicy: "block",
};

/**
 * Effective access = registry defaults < plan quotas < per-subscription overrides.
 * Overrides let the owner grant one workspace extra headroom without cloning a plan.
 */
export const resolvePlanAccess = (plan: IPlan, subscription?: ISubscription | null): ResolvedPlanAccess => {
    const planQuotas = toRecord<number>(plan.quotas);
    const overrides = toRecord<number>(subscription?.quotaOverrides);
    const quotas: PlanQuotas = { ...registryDefaults() };

    for (const [key, value] of Object.entries(planQuotas)) {
        if (isQuotaMetric(key) && Number.isFinite(value)) quotas[key] = value;
    }

    for (const [key, value] of Object.entries(overrides)) {
        if (isQuotaMetric(key) && Number.isFinite(value)) quotas[key] = value;
    }

    const planEntitlements = toRecord<boolean>(plan.entitlements);
    const entitlements: PlanEntitlements = emptyEntitlements();
    for (const key of entitlementKeys) {
        entitlements[key] = Boolean(planEntitlements[key]);
    }

    return {
        planId: String(plan._id),
        planCode: plan.code,
        planName: plan.name,
        status: subscription?.status || "none",
        billingCycle: subscription?.billingCycle ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        quotas,
        entitlements,
        overagePolicy: plan.overagePolicy,
    };
};
