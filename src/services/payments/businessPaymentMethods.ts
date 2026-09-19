import { z } from "zod";
import PaymentMethodConfig from "../../models/PaymentMethodConfig.js";
import "../../core/payments/payment.strategies.js";
import { PaymentGatewayFactory } from "../../core/payments/payment-gateway.factory.js";
import { authorizeBusinessPayment } from "./authorization.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";

const inputSchema = z.object({
    label: z.string().trim().min(1).max(120),
    isEnabled: z.boolean(),
    isTestMode: z.boolean(),
    sortOrder: z.number().int().min(0),
    instructions: z.string().trim().max(2000),
    supportedCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(20),
    settings: z.record(z.string(), z.union([z.string().max(500), z.number().finite(), z.boolean()])),
}).strict();

export const listBusinessPaymentMethods = async (user: AuthenticatedUserContext) => {
    authorizeBusinessPayment(user, "payment_methods.manage");
    const configs = await PaymentMethodConfig.find().select("-credentials").lean().exec();
    return PaymentGatewayFactory.listDescriptors().map(descriptor => {
        const config = configs.find(item => item.provider === descriptor.provider);
        return {
            provider: descriptor.provider,
            description: descriptor.description,
            mode: descriptor.mode,
            settingFields: descriptor.settingFields,
            availableCurrencies: descriptor.supportedCurrencies,
            label: config?.label || descriptor.label,
            isEnabled: config?.isEnabled || false,
            isTestMode: config?.isTestMode ?? true,
            sortOrder: config?.sortOrder || 0,
            instructions: config?.instructions || "",
            supportedCurrencies: config?.supportedCurrencies || descriptor.supportedCurrencies,
            settings: config?.settings || {},
        };
    });
};

export const saveBusinessPaymentMethod = async (user: AuthenticatedUserContext, provider: string, input: unknown) => {
    authorizeBusinessPayment(user, "payment_methods.manage");
    if (!PaymentGatewayFactory.hasProvider(provider)) throw notFoundError("Payment provider not found.");
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw unprocessableEntityError("Invalid payment method settings.");
    const gateway = PaymentGatewayFactory.getProvider(provider);
    const descriptor = gateway.descriptor();
    const data = parsed.data;
    if (data.supportedCurrencies.some(currency => !descriptor.supportedCurrencies.includes(currency))) {
        throw unprocessableEntityError("This provider does not support the selected currencies.");
    }
    for (const [key, value] of Object.entries(data.settings)) {
        const field = descriptor.settingFields.find(item => item.key === key);
        if (!field) throw unprocessableEntityError(`Unknown setting: ${key}`);
        if (field.type === "number") {
            if (typeof value !== "number" || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
                throw unprocessableEntityError(`Invalid ${field.label}.`);
            }
        } else if (field.type === "boolean" ? typeof value !== "boolean" : typeof value !== "string") {
            throw unprocessableEntityError(`Invalid ${field.label}.`);
        }
    }
    if (data.isEnabled) {
        const existing = await PaymentMethodConfig.findOne({ provider }).exec();
        const credentials = existing ? Object.fromEntries(existing.credentials) : {};
        gateway.validateConfig({ ...data, provider, credentials, payerFields: [] });
        if (provider === "stripe") {
            const secretKey = credentials.secretKey || process.env.STRIPE_SECRET_KEY || "";
            if (!secretKey.startsWith(data.isTestMode ? "sk_test_" : "sk_live_")) {
                throw unprocessableEntityError("Stripe key does not match the selected test/live mode.");
            }
            if (!(credentials.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET)) {
                throw unprocessableEntityError("Configure the Stripe webhook secret before enabling this method.");
            }
        }
        const min = data.settings.minAmount;
        const max = data.settings.maxAmount;
        if (typeof min === "number" && typeof max === "number" && max > 0 && min > max) {
            throw unprocessableEntityError("Minimum amount cannot exceed maximum amount.");
        }
    }
    await PaymentMethodConfig.updateOne({ provider }, { $set: data, $setOnInsert: { provider } }, { upsert: true, runValidators: true });
    return (await listBusinessPaymentMethods(user)).find(item => item.provider === provider);
};
