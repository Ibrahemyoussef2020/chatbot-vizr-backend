import type { EntitlementDefinition, QuotaMetricDefinition, QuotaUnit, QuotaWindow } from "./plan.types.js";
import { UNLIMITED } from "./plan.types.js";

const metric = (
    key: string,
    label: string,
    category: string,
    unit: QuotaUnit,
    window: QuotaWindow,
    description: string,
    defaultLimit: number,
    enforced = false,
): QuotaMetricDefinition => ({ key, label, category, unit, window, description, defaultLimit, enforced });

export const quotaRegistry: QuotaMetricDefinition[] = [
    metric("requests.per_second", "Requests Per Second", "Traffic", "requests", "per_second", "Burst ceiling for inbound chat and API requests.", 5, true),
    metric("requests.daily", "Requests Per Day", "Traffic", "requests", "per_day", "Total inbound chat and API requests allowed each day.", 5_000, true),
    metric("requests.monthly", "Requests Per Month", "Traffic", "requests", "per_month", "Total inbound chat and API requests allowed each month.", 100_000, true),
    metric("conversations.monthly", "Conversations Per Month", "Conversations", "conversations", "per_month", "New customer conversations opened each month.", 1_000, true),
    metric("messages.daily", "Messages Per Day", "Conversations", "messages", "per_day", "Inbound and outbound messages handled each day.", 2_000, true),
    metric("messages.monthly", "Messages Per Month", "Conversations", "messages", "per_month", "Inbound and outbound messages handled each month.", 40_000, true),
    metric("tokens.monthly", "AI Tokens Per Month", "AI", "tokens", "per_month", "Model tokens consumed across every AI provider each month.", 2_000_000, true),
    metric("ai.replies.daily", "AI Replies Per Day", "AI", "requests", "per_day", "Automated AI replies generated each day.", 1_500, true),
    metric("ai.models.max", "Concurrent AI Models", "AI", "items", "total", "Distinct AI models the workspace may keep configured.", 3),
    metric("seats.max", "Team Seats", "Team", "seats", "total", "Users who may hold a seat inside the workspace.", 5),
    metric("workspaces.max", "Workspaces", "Team", "items", "total", "Workspaces the account may provision.", 1),
    metric("roles.max", "Custom Roles", "Team", "items", "total", "Custom security roles beyond the built-in set.", 5),
    metric("channels.max", "Connected Channels", "Channels", "items", "total", "Messaging platforms connected at once.", 2),
    metric("widgets.max", "Web Widgets", "Channels", "items", "total", "Embeddable website widgets published at once.", 1),
    metric("telegram_bots.max", "Telegram Bots", "Channels", "items", "total", "Telegram bots registered to the workspace.", 1),
    metric("whatsapp_numbers.max", "WhatsApp Numbers", "Channels", "items", "total", "WhatsApp business numbers connected at once.", 1),
    metric("knowledge.sessions.max", "Knowledge Sessions", "Knowledge", "items", "total", "Knowledge base sessions kept active.", 10),
    metric("knowledge.uploads.monthly", "Knowledge Uploads Per Month", "Knowledge", "items", "per_month", "Source documents uploaded each month.", 100, true),
    metric("knowledge.storage_mb", "Knowledge Storage", "Knowledge", "megabytes", "total", "Total stored knowledge source size.", 1_024),
    metric("knowledge.outputs.monthly", "Generated Outputs Per Month", "Knowledge", "items", "per_month", "AI-generated plans and reports produced each month.", 200, true),
    metric("api_keys.max", "API Keys", "Developers", "items", "total", "Active developer API keys.", 3),
    metric("webhooks.max", "Outbound Webhooks", "Developers", "items", "total", "Outbound webhook endpoints registered.", 3),
    metric("automations.max", "Automations", "Developers", "items", "total", "Automation workflows kept enabled.", 5),
    metric("history.retention_days", "Conversation Retention", "Retention", "days", "total", "Days of conversation history retained.", 90),
    metric("logs.retention_days", "Log Retention", "Retention", "days", "total", "Days of system and audit logs retained.", 30),
];

const entitlement = (key: string, label: string, category: string, description: string): EntitlementDefinition =>
    ({ key, label, category, description });

export const entitlementRegistry: EntitlementDefinition[] = [
    entitlement("human_takeover", "Human Takeover & Routing", "Inbox", "Allow agents to take over an AI conversation and route it between teammates."),
    entitlement("custom_persona", "Custom AI Persona & Model Policy", "AI", "Define bespoke system prompts, personas, and per-channel model policies."),
    entitlement("audit_logs", "Audit Logs", "Compliance", "Retain and export a tamper-evident record of privileged actions."),
    entitlement("sla_monitoring", "SLA Monitoring", "Compliance", "Track first-response and resolution targets with breach alerting."),
    entitlement("priority_support", "Priority Support", "Support", "Escalate directly to priority email and live chat support queues."),
    entitlement("custom_api", "Custom REST API Access", "Developers", "Call the full public REST API with scoped developer keys."),
    entitlement("white_label", "White Label Branding", "Experience", "Remove Vizr branding from the widget and transactional email."),
    entitlement("sso", "Single Sign-On", "Security", "Authenticate the team through a SAML or OIDC identity provider."),
    entitlement("data_export", "Bulk Data Export", "Compliance", "Download conversations, customers, and analytics in bulk."),
];

export const quotaMetricKeys = quotaRegistry.map((item) => item.key);
export const enforcedQuotaMetricKeys = quotaRegistry.filter((item) => item.enforced).map((item) => item.key);
export const entitlementKeys = entitlementRegistry.map((item) => item.key);

const metricIndex = new Map(quotaRegistry.map((item) => [item.key, item]));

export const findQuotaMetric = (key: string): QuotaMetricDefinition | undefined => metricIndex.get(key);

export const isQuotaMetric = (key: string): boolean => metricIndex.has(key);

export const isEntitlement = (key: string): boolean => entitlementRegistry.some((item) => item.key === key);

/** Baseline access for a workspace with no subscription: enough to evaluate the product, not to run on it. */
export const freePlanQuotas: Record<string, number> = {
    "requests.per_second": 1,
    "requests.daily": 100,
    "requests.monthly": 1_000,
    "conversations.monthly": 25,
    "messages.daily": 50,
    "messages.monthly": 500,
    "tokens.monthly": 50_000,
    "ai.replies.daily": 25,
    "ai.models.max": 1,
    "seats.max": 1,
    "workspaces.max": 1,
    "roles.max": 0,
    "channels.max": 1,
    "widgets.max": 1,
    "telegram_bots.max": 1,
    "whatsapp_numbers.max": 0,
    "knowledge.sessions.max": 2,
    "knowledge.uploads.monthly": 5,
    "knowledge.storage_mb": 50,
    "knowledge.outputs.monthly": 10,
    "api_keys.max": 1,
    "webhooks.max": 0,
    "automations.max": 0,
    "history.retention_days": 14,
    "logs.retention_days": 7,
};

export { UNLIMITED };
