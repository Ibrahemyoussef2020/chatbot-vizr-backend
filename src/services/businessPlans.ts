import { Types } from "mongoose";
import { z } from "zod";
import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { conflictError, forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";

const price = z.number().finite().min(0).nullable();
export const planInputSchema = z.object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(80),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    pricing: z.object({ monthly: price, yearly: price }).strict(),
    status: z.enum(["draft", "published", "archived"]),
    visibility: z.enum(["public", "private"]),
    popular: z.boolean().default(false),
    trialDays: z.number().int().min(0).max(365).default(0),
    sortOrder: z.number().int().min(0).default(0),
    features: z.array(z.string().trim().min(1).max(250)).max(50).default([]),
}).strict();

const authorize = (user: AuthenticatedUserContext) => {
    if (!user.permissions?.includes("plans.manage")) {
        throw forbiddenError("Missing permission: plans.manage");
    }
};

const findPlan = async (id: string) => {
    if (!Types.ObjectId.isValid(id)) throw notFoundError("Plan not found.");
    const plan = await Plan.findById(id).exec();
    if (!plan) throw notFoundError("Plan not found.");
    return plan;
};

export const listBusinessPlans = async (user: AuthenticatedUserContext) => {
    authorize(user);
    return Plan.find().sort({ sortOrder: 1, createdAt: 1 }).lean().exec();
};

export const saveBusinessPlan = async (user: AuthenticatedUserContext, input: unknown, id?: string) => {
    authorize(user);
    const parsed = planInputSchema.safeParse(input);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw unprocessableEntityError(`${issue.path.join(".")}: ${issue.message}`);
    }
    const plan = id ? await findPlan(id) : new Plan();
    if (id && plan.code !== parsed.data.code && (
        await Subscription.exists({ planId: id }) || await PaymentTransaction.exists({ planId: id })
    )) {
        throw conflictError("A plan referenced by subscriptions or payments cannot change its code.");
    }
    plan.set(parsed.data);
    try {
        await plan.save();
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            throw conflictError("A plan with this code already exists.");
        }
        throw error;
    }
    return plan.toObject();
};

export const deleteBusinessPlan = async (user: AuthenticatedUserContext, id: string) => {
    authorize(user);
    const plan = await findPlan(id);
    if (await Subscription.exists({ planId: plan._id }) || await PaymentTransaction.exists({ planId: plan._id })) {
        throw conflictError("This plan has subscriptions or payments. Archive it instead of deleting it.");
    }
    await plan.deleteOne();
    return { deleted: true };
};
