import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { subscribeToPlan as executeSubscribe } from "../services/payments/subscription.js";

const handleSubscribe = async (req: Request, res: Response) => {
    const planCode = req.body.planCode;
    const provider = req.body.provider;
    const billingCycle = req.body.billingCycle;
    const email = req.body.email;
    const name = req.body.name;
    const payerFields = req.body.payerFields;

    const result = await executeSubscribe({
        planCode,
        provider,
        billingCycle,
        email,
        name,
        payerFields,
    });

    res.status(200).json(result);
};

export const subscribe = asyncHandler(handleSubscribe);
