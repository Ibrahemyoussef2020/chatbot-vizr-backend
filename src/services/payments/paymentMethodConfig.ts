import PaymentMethodConfig from "../../models/PaymentMethodConfig.js";
import Workspace from "../../models/Workspace.js";
import WorkspacePaymentMethodConfig from "../../models/WorkspacePaymentMethodConfig.js";
import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { forbiddenError, notFoundError } from "../../core/shared/errors/HttpError.js";
import { decryptCredential } from "./credentialVault.js";

const record = (value: unknown): Record<string, unknown> => value instanceof Map ? Object.fromEntries(value) : (value && typeof value === "object" ? value as Record<string, unknown> : {});
const credentials = (value: unknown) => Object.fromEntries(Object.entries(record(value)).map(([key, secret]) => [key, typeof secret === "string" ? decryptCredential(secret) : ""]));

export const resolveWorkspaceForPayment = async (user: AuthenticatedUserContext, requestedSlug?: string) => {
    if (requestedSlug) {
        const workspace = await Workspace.findOne({ slug: requestedSlug }).select("ownerId").lean().exec();
        if (!workspace) throw notFoundError("Workspace not found.");
        if (user.role !== "super_admin" && String(workspace.ownerId) !== user.id && String(workspace._id) !== user.workspaceId) {
            throw forbiddenError("You can only configure payment methods for your own workspace.");
        }
        return String(workspace._id);
    }
    return user.workspaceId;
};

export const getEffectivePaymentMethodConfig = async (provider: string, workspaceId?: string) => {
    const [workspaceConfig, globalConfig] = workspaceId
        ? await Promise.all([
            WorkspacePaymentMethodConfig.findOne({ workspaceId, provider }).select("+credentials").lean().exec(),
            PaymentMethodConfig.findOne({ provider }).lean().exec(),
        ])
        : [null, await PaymentMethodConfig.findOne({ provider }).lean().exec()];
    const selected = workspaceConfig || globalConfig;
    if (!selected) return null;
    const storedWorkspaceCredentials = workspaceConfig ? credentials(workspaceConfig.credentials) : {};
    const storedGlobalCredentials = globalConfig ? credentials(globalConfig.credentials) : {};
    return {
        ...selected,
        workspaceId: workspaceConfig?.workspaceId || undefined,
        credentials: { ...storedGlobalCredentials, ...storedWorkspaceCredentials },
        workspaceCredentialKeys: Object.keys(storedWorkspaceCredentials),
        globalCredentialKeys: Object.keys(storedGlobalCredentials),
        settings: record(selected.settings),
        payerFields: selected.payerFields || [],
        isWorkspaceOverride: Boolean(workspaceConfig),
    };
};
