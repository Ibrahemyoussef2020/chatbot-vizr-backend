export type BillingCycle = "monthly" | "yearly";

export type PlanStatus = "draft" | "published" | "archived";

export type QuotaWindow = "per_second" | "per_day" | "per_month" | "total";

export type QuotaUnit = "requests" | "conversations" | "messages" | "tokens" | "seats" | "items" | "megabytes" | "days";

export const UNLIMITED = -1;

export interface QuotaMetricDefinition {
    key: string;
    label: string;
    category: string;
    unit: QuotaUnit;
    window: QuotaWindow;
    description: string;
    /** Runtime-enforced by enforceQuota middleware; the rest are ceilings checked at creation time. */
    enforced: boolean;
    defaultLimit: number;
}

export interface EntitlementDefinition {
    key: string;
    label: string;
    category: string;
    description: string;
}

export type PlanQuotas = Record<string, number>;
export type PlanEntitlements = Record<string, boolean>;

export interface ResolvedPlanAccess {
    planId: string | null;
    planCode: string;
    planName: string;
    status: string;
    billingCycle: BillingCycle | null;
    currentPeriodEnd: Date | null;
    quotas: PlanQuotas;
    entitlements: PlanEntitlements;
    overagePolicy: "block" | "throttle" | "allow";
}
