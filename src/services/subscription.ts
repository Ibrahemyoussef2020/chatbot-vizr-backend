import { unprocessableEntityError } from "../core/shared/errors/HttpError.js";

export interface SubscriptionInput {
    planCode: string;
    billingCycle?: "monthly" | "yearly";
    email?: string;
    name?: string;
}

export const subscribeToPlan = async (input: SubscriptionInput) => {
    const planCode = input.planCode?.toLowerCase().trim();
    if (!planCode) {
        throw unprocessableEntityError("Plan code is required");
    }

    const billingCycle = input.billingCycle === "yearly" ? "yearly" : "monthly";

    const planPrices: Record<string, { monthly: number; yearly: number; name: string }> = {
        starter: { monthly: 29, yearly: 290, name: "Starter" },
        launch: { monthly: 79, yearly: 790, name: "Launch" },
        scale_pro: { monthly: 199, yearly: 1990, name: "Scale Pro" },
        enterprise: { monthly: 499, yearly: 4990, name: "Enterprise" },
    };

    const plan = planPrices[planCode] || {
        monthly: 49,
        yearly: 490,
        name: planCode.toUpperCase(),
    };

    const price = billingCycle === "yearly" ? plan.yearly : plan.monthly;
    const checkoutUrl = `/admin/dashboard?subscribed=${encodeURIComponent(planCode)}&cycle=${billingCycle}`;

    return {
        success: true,
        message: `Successfully generated checkout session for ${plan.name} (${billingCycle})`,
        subscription: {
            planCode,
            planName: plan.name,
            billingCycle,
            price,
            currency: "USD",
            checkoutUrl,
        },
    };
};
