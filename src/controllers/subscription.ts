import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getWorkspaceSubscriptionStatus, startFreeSubscription as executeFreeSubscription, subscribeToPlan as executeSubscribe } from "../services/payments/subscription.js";
import { listCheckoutPaymentMethods } from "../services/payments/businessPaymentMethods.js";

const handleSubscribe = async (req: Request, res: Response) => {
    const planCode = req.body.planCode;
    const provider = req.body.provider;
    const billingCycle = req.body.billingCycle;
    const email = req.body.email;
    const name = req.body.name;
    const payerFields = req.body.payerFields;
    const workspaceSlug = req.body.system_slug;

    const result = await executeSubscribe({
        planCode,
        provider,
        billingCycle,
        email,
        name,
        payerFields,
        workspaceSlug,
    }, res.locals.user);

    res.status(200).json(result);
};

export const subscribe = asyncHandler(handleSubscribe);

const handleCheckoutMethods = async (req: Request, res: Response) => {
    const workspaceSlug = typeof req.query.system_slug === "string" ? req.query.system_slug : undefined;
    res.status(200).json({ success: true, data: await listCheckoutPaymentMethods(res.locals.user, workspaceSlug) });
};
export const checkoutMethods = asyncHandler(handleCheckoutMethods);

const handleFreePlan = async (req: Request, res: Response) => {
    const result = await executeFreeSubscription(
        res.locals.user,
        String(req.body.planCode || ""),
        req.body.billingCycle === "yearly" ? "yearly" : "monthly",
    );
    res.status(200).json({ success: true, subscription: result });
};

export const startFreePlan = asyncHandler(handleFreePlan);

const handleSubscriptionStatus = async (_req: Request, res: Response) => {
    const data = await getWorkspaceSubscriptionStatus(res.locals.user);
    res.status(200).json({ success: true, data });
};

export const subscriptionStatus = asyncHandler(handleSubscriptionStatus);
