import { Types } from "mongoose";
import { z } from "zod";
import PaymentTransaction from "../../models/PaymentTransaction.js";
import { Subscription, Workspace } from "../../models/index.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import { authorizeBusinessPayment } from "./authorization.js";

const filters = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).default(""),
    status: z.enum(["all", "pending", "awaiting_review", "succeeded", "failed", "refunded", "cancelled"]).default("all"),
    provider: z.enum(["all", "stripe", "vodafone_cash"]).default("all"),
});

export const paymentProjection = "reference workspaceId planCode provider billingCycle amount currency status payerEmail payerName providerRef reviewedAt reviewNote failureReason createdAt";

export const listBusinessPayments = async (user: AuthenticatedUserContext, input: unknown) => {
    authorizeBusinessPayment(user, "payments.view");
    const parsed = filters.safeParse(input);
    if (!parsed.success) throw unprocessableEntityError("Invalid payment filters.");
    const { page, limit, search, status, provider } = parsed.data;
    const query: Record<string, unknown> = {};
    if (status !== "all") query.status = status;
    if (provider !== "all") query.provider = provider;
    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query.$or = ["reference", "payerEmail", "payerName", "planCode"].map(field => ({ [field]: new RegExp(escaped, "i") }));
    }
    const [items, total] = await Promise.all([
        PaymentTransaction.find(query).select(paymentProjection).populate("workspaceId", "name slug").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
        PaymentTransaction.countDocuments(query),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
};

export const readBusinessPayment = async (user: AuthenticatedUserContext, id: string) => {
    authorizeBusinessPayment(user, "payments.view");
    if (!Types.ObjectId.isValid(id)) throw notFoundError("Payment not found.");
    const payment = await PaymentTransaction.findById(id).select(paymentProjection).populate("workspaceId", "name slug").lean().exec();
    if (!payment) throw notFoundError("Payment not found.");
    return payment;
};

export const decideBusinessPayment = async (user: AuthenticatedUserContext, id: string, decision: "approve" | "reject", note: string) => {
    if (user.role !== "super_admin") throw new Error("Only a super administrator can confirm workspace payments.");
    if (!Types.ObjectId.isValid(id)) throw notFoundError("Payment not found.");
    const payment = await PaymentTransaction.findById(id).exec();
    if (!payment) throw notFoundError("Payment not found.");
    if (!["pending", "awaiting_review"].includes(payment.status)) throw unprocessableEntityError("This payment has already been decided.");
    const message = note.trim().slice(0, 1000);
    payment.reviewedBy = new Types.ObjectId(user.id);
    payment.reviewedAt = new Date();
    payment.reviewNote = message;
    if (decision === "approve") {
        payment.status = "succeeded";
        const workspace = payment.workspaceId ? await Workspace.findById(payment.workspaceId).exec() : null;
        if (workspace) {
            workspace.selectedPlanCode = payment.planCode;
            workspace.isActive = true;
            await workspace.save();
            const start = new Date();
            const end = new Date(start);
            payment.billingCycle === "yearly" ? end.setFullYear(end.getFullYear() + 1) : end.setMonth(end.getMonth() + 1);
            await Subscription.findOneAndUpdate({ workspaceId: workspace._id, status: { $in: ["trialing", "active", "past_due"] } }, { $set: { planId: payment.planId, planCode: payment.planCode, status: "active", billingCycle: payment.billingCycle, currentPeriodStart: start, currentPeriodEnd: end, provider: payment.provider, cancelAtPeriodEnd: false }, $setOnInsert: { workspaceId: workspace._id } }, { upsert: true, new: true, runValidators: true }).exec();
        }
    } else {
        payment.status = "failed";
        payment.failureReason = message || "Workspace request was refused by the business administrator.";
    }
    await payment.save();
    return { status: payment.status, message: message || (decision === "approve" ? "Workspace approved." : "Workspace refused.") };
};
