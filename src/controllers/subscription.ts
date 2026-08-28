import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { subscribeToPlan as executeSubscribe } from "../services/subscription.js";

const handleSubscribe = async (req: Request, res: Response) => {
    const planCode = req.body.planCode;
    const billingCycle = req.body.billingCycle;
    const email = req.body.email;
    const name = req.body.name;

    const result = await executeSubscribe({
        planCode,
        billingCycle,
        email,
        name,
    });

    res.status(200).json(result);
};

export const subscribe = asyncHandler(handleSubscribe);
