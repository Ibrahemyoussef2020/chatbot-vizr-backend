import { z } from "zod";
import PaymentMethodConfig from "../../models/PaymentMethodConfig.js";
import Workspace from "../../models/Workspace.js";
import "../../core/payments/payment.strategies.js";
import { PaymentGatewayFactory } from "../../core/payments/payment-gateway.factory.js";
import { authorizeBusinessPayment } from "./authorization.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { notFoundError, unprocessableEntityError } from "../../core/shared/errors/HttpError.js";
import { stripeCredentialEnvironment } from "./credentialVault.js";
import { getEffectivePaymentMethodConfig, resolveWorkspaceForPayment } from "./paymentMethodConfig.js";

const inputSchema = z.object({
    label: z.string().trim().min(1).max(120),
    isEnabled: z.boolean(),
    isTestMode: z.boolean(),
    sortOrder: z.number().int().min(0),
    instructions: z.string().trim().max(2000),
    supportedCurrencies: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(20),
    settings: z.record(z.string(), z.union([z.string().max(500), z.number().finite(), z.boolean()])),
    credentials: z.record(z.string(), z.string().max(500)).default({}),
    clearCredentials: z.array(z.string()).default([]),
    system_slug: z.string().optional(),
}).strict();

export const listBusinessPaymentMethods = async (user: AuthenticatedUserContext, requestedWorkspace?: string) => {
    authorizeBusinessPayment(user, "payment_methods.manage");
    await resolveWorkspaceForPayment(user, requestedWorkspace);
    return Promise.all(PaymentGatewayFactory.listDescriptors().map(async descriptor => {
        const config = await getEffectivePaymentMethodConfig(descriptor.provider);
        const envKeys = stripeCredentialEnvironment;
        const credentialStatus = Object.fromEntries(descriptor.credentialFields.map(field => {
            const source = config?.globalCredentialKeys.includes(field.key)
                    ? "global"
                    : envKeys[field.key] && process.env[envKeys[field.key]]
                        ? "environment"
                        : "missing";
            return [field.key, source];
        }));
        return {
            provider: descriptor.provider,
            description: descriptor.description,
            mode: descriptor.mode,
            settingFields: descriptor.settingFields,
            availableCurrencies: descriptor.supportedCurrencies,
            credentialFields: descriptor.credentialFields,
            credentialStatus,
            workspaceName: "Global settings",
            label: config?.label || descriptor.label,
            isEnabled: config?.isEnabled || false,
            isTestMode: config?.isTestMode ?? true,
            sortOrder: config?.sortOrder || 0,
            instructions: config?.instructions || "",
            supportedCurrencies: config?.supportedCurrencies || descriptor.supportedCurrencies,
            settings: config?.settings || {},
        };
    }));
};

/** Safe checkout options for signed-in customers. Never returns gateway credentials. */
export const listCheckoutPaymentMethods = async (user?: AuthenticatedUserContext, requestedWorkspace?: string) => {
    if (user && requestedWorkspace) await resolveWorkspaceForPayment(user, requestedWorkspace);
    const methods = await Promise.all(PaymentGatewayFactory.listDescriptors().map(async descriptor => {
        const config = await getEffectivePaymentMethodConfig(descriptor.provider);
        if (!config?.isEnabled) return null;
        return {
            provider: descriptor.provider,
            label: config.label || descriptor.label,
            description: descriptor.description,
            mode: descriptor.mode,
            isTestMode: config.isTestMode,
            supportedCurrencies: config.supportedCurrencies,
            instructions: config.instructions || "",
            payerFields: (config.payerFields?.length ? config.payerFields : descriptor.defaultPayerFields)
                .filter((field: { type: string }) => field.type !== "file")
                .map((field: { key: string; label: string; type: string; required: boolean; placeholder?: string; helpText?: string }) => ({ key: field.key, label: field.label, type: field.type, required: field.required, placeholder: field.placeholder || "", helpText: field.helpText || "" })),
        };
    }));
    return methods.filter((method): method is NonNullable<typeof method> => Boolean(method)).sort((a, b) => a.provider.localeCompare(b.provider));
};

export const saveBusinessPaymentMethod = async (user: AuthenticatedUserContext, provider: string, input: unknown, requestedWorkspace?: string) => {
    authorizeBusinessPayment(user, "payment_methods.manage");
    if (!PaymentGatewayFactory.hasProvider(provider)) throw notFoundError("Payment provider not found.");
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw unprocessableEntityError("Invalid payment method settings.");
    const gateway = PaymentGatewayFactory.getProvider(provider);
    const descriptor = gateway.descriptor();
    const data = parsed.data;
    const workspaceId = await resolveWorkspaceForPayment(user, requestedWorkspace || data.system_slug);
    const credentialKeys = descriptor.credentialFields.map(field => field.key);
    if ([...Object.keys(data.credentials), ...data.clearCredentials].some(key => !credentialKeys.includes(key))) {
        throw unprocessableEntityError("Unknown provider credential field.");
    }
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
    // Payment methods are a global platform setting shared by every workspace.
    const globalConfig = await PaymentMethodConfig.findOne({ provider }).exec();
    const globalCredentials = globalConfig ? Object.fromEntries(globalConfig.credentials) : {};
    const credentials: Record<string, string> = { ...globalCredentials };
    for (const key of data.clearCredentials) {
        delete credentials[key];
        if (globalCredentials[key]) credentials[key] = globalCredentials[key];
    }
    for (const [key, value] of Object.entries(data.credentials)) if (value.trim()) credentials[key] = value.trim();
    const configForValidation = {
        provider,
        label: data.label,
        isEnabled: data.isEnabled,
        isTestMode: data.isTestMode,
        credentials,
        settings: data.settings,
        payerFields: [],
        supportedCurrencies: data.supportedCurrencies,
        instructions: data.instructions,
    };
    if (data.isEnabled) {
        gateway.validateConfig(configForValidation);
        if (provider === "stripe") {
            const secretKey = credentials.secretKey || process.env.STRIPE_SECRET_KEY || "";
            if (!secretKey.startsWith(data.isTestMode ? "sk_test_" : "sk_live_")) {
                throw unprocessableEntityError("Stripe key does not match the selected test/live mode.");
            }
            if (!(credentials.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET)) {
                throw unprocessableEntityError("Configure the Stripe webhook secret before enabling this method.");
            }
        }
        if (provider === "vodafone_cash" && !data.isTestMode && data.supportedCurrencies.includes("USD")) {
            throw unprocessableEntityError("Live Vodafone Cash transfers accept EGP only. USD is available only in test mode.");
        }
        const min = data.settings.minAmount;
        const max = data.settings.maxAmount;
        if (typeof min === "number" && typeof max === "number" && max > 0 && min > max) {
            throw unprocessableEntityError("Minimum amount cannot exceed maximum amount.");
        }
    }
    const { credentials: _credentials, clearCredentials: _clearCredentials, system_slug: _systemSlug, ...configData } = data;
    await PaymentMethodConfig.updateOne(
        { provider },
        { $set: { ...configData, credentials }, $setOnInsert: { provider } },
        { upsert: true, runValidators: true },
    );
    return (await listBusinessPaymentMethods(user)).find(item => item.provider === provider);
};
