export interface PermissionDefinition {
    id: string;
    name: string;
    category: string;
    description: string;
    scope: "business" | "workspace";
}

const permission = (
    id: string,
    name: string,
    category: string,
    description: string,
    scope: "business" | "workspace" = "workspace",
): PermissionDefinition => ({ id, name, category, description, scope });

export const permissionRegistry: PermissionDefinition[] = [
    permission("business.manage", "Manage Vizr Business", "Business", "Manage the Vizr SaaS business and global configuration.", "business"),
    permission("plans.manage", "Manage Plans", "Business", "Create, price, publish, pause, and retire subscription plans.", "business"),
    permission("workspaces.create", "Create Workspaces", "Business", "Provision client and business-owned workspaces.", "business"),
    permission("workspaces.view_all", "View All Workspaces", "Business", "View business-owned and client workspace records.", "business"),
    permission("workspaces.manage_owned", "Manage Owned Workspaces", "Business", "Manage only workspaces owned by the business account.", "business"),
    permission("landing.manage", "Manage Landing Page", "Business", "Edit public landing, pricing, about, and legal content.", "business"),
    permission("business.users.manage", "Manage Business Users", "Business", "Invite, suspend, and administer business-level users.", "business"),
    permission("business.roles.manage", "Manage Business Roles", "Business", "Create delegated business administration roles.", "business"),
    permission("workspace.settings.manage", "Manage Workspace Settings", "Workspace", "Update workspace identity, limits, and configuration."),
    permission("workspace.users.manage", "Manage Workspace Users", "Workspace", "Invite, edit, suspend, and remove workspace users."),
    permission("workspace.customers.manage", "Manage Customers", "Workspace", "View and update customer profiles and lifecycle data."),
    permission("workspace.roles.manage", "Manage Roles", "Workspace", "Create and update roles within the current workspace."),
    permission("workspace.permissions.assign", "Assign Permissions", "Workspace", "Assign allowed workspace capabilities to roles and users."),
    permission("knowledge.use", "Use Knowledge Base", "Knowledge", "Use approved knowledge when answering customers."),
    permission("knowledge.view", "View Knowledge Base", "Knowledge", "Read sources, documents, sites, and synchronized data."),
    permission("knowledge.manage", "Manage Knowledge Base", "Knowledge", "Upload, edit, synchronize, and remove knowledge sources."),
    permission("knowledge.train", "Train Knowledge & Data", "Knowledge", "Start indexing, embedding, fine-tuning, and evaluation jobs."),
    permission("prompts.manage", "Manage Prompts", "Knowledge", "Create and update system prompts, rules, personas, and context."),
    permission("agent.data.manage", "Manage Agent Training Data", "Knowledge", "Add curated examples and data agents may use for tuning."),
    permission("reply.ai_custom.control", "Run/Stop Custom AI Replies", "Reply Control", "Enable or stop replies from the custom/internal AI engine."),
    permission("reply.ai_vercel.control", "Run/Stop Vercel AI Replies", "Reply Control", "Enable or stop replies routed through Vercel AI providers."),
    permission("reply.human.control", "Run/Stop Human Replies", "Reply Control", "Allow or pause human-agent replies."),
    permission("reply.mode.manage", "Manage Reply Mode", "Reply Control", "Choose AI, human, or hybrid reply strategy per channel."),
    permission("inbox.view", "View Inbox", "Inbox", "View workspace conversations and message history."),
    permission("inbox.reply_any", "Reply to Any Conversation", "Inbox", "Reply to any workspace conversation."),
    permission("inbox.reply_assigned", "Reply to Assigned Conversations", "Inbox", "Reply only to conversations assigned to the agent."),
    permission("inbox.status.manage", "Manage Conversation Status", "Inbox", "Open, close, prioritize, and resolve conversations."),
    permission("inbox.assign", "Assign Conversations", "Inbox", "Assign conversations to agents."),
    permission("inbox.unassign", "Stop Assignments", "Inbox", "Remove or stop an agent assignment."),
    permission("inbox.notes.manage", "Manage Internal Notes", "Inbox", "Create and remove private team notes."),
    permission("tags.manage", "Manage Tags", "Inbox", "Create tags and apply them to conversations."),
    permission("agents.manage", "Manage AI & Human Agents", "Agents", "Create, configure, enable, pause, and remove agents."),
    permission("agents.assign", "Assign Agent Work", "Agents", "Assign missions, queues, and conversations to agents."),
    permission("tokens.view", "View Token Usage", "Agents", "View model token consumption, latency, and cost."),
    permission("tokens.manage", "Manage Tokens & API Keys", "Agents", "Create, rotate, limit, and revoke AI credentials."),
    permission("channels.view", "View Platforms", "Channels", "View connected communication platforms and status."),
    permission("channels.access.manage", "Turn Platform Access On/Off", "Channels", "Enable or disable channel access for the workspace."),
    permission("channels.configure", "Configure Platforms", "Channels", "Connect and configure website, WhatsApp, Telegram, Gmail, and future platforms."),
    permission("channels.web.manage", "Manage Web Chat", "Channels", "Configure the public website chatbot and sessions."),
    permission("channels.whatsapp.manage", "Manage WhatsApp", "Channels", "Configure WhatsApp credentials, templates, and sessions."),
    permission("channels.telegram.manage", "Manage Telegram", "Channels", "Configure Telegram bots, webhooks, and tests."),
    permission("channels.gmail.manage", "Manage Gmail", "Channels", "Connect Gmail, renew watches, and manage email conversations."),
    permission("widget.manage", "Manage Widget", "Experience", "Customize, publish, and restrict the embedded widget."),
    permission("analytics.view", "View Analytics", "Analytics", "View conversation, resolution, customer, and channel analytics."),
    permission("logs.view", "View Logs", "Analytics", "View system, webhook, AI, and audit logs."),
    permission("logs.export", "Export Logs", "Analytics", "Download operational and audit logs."),
    permission("automation.manage", "Manage Automations", "Automation", "Create and control triggers, workflows, and actions."),
    permission("webhooks.manage", "Manage Webhooks", "Developers", "Create, rotate, test, and disable outbound webhooks."),
    permission("api_keys.manage", "Manage API Keys", "Developers", "Create and revoke scoped developer API keys."),
    permission("billing.view", "View Billing", "Billing", "View plan, invoices, limits, and usage."),
    permission("billing.manage", "Manage Billing", "Billing", "Change subscription and billing settings."),
];

export const businessPermissionIds = permissionRegistry.map((item) => item.id);
export const workspacePermissionIds = permissionRegistry
    .filter((item) => item.scope === "workspace")
    .map((item) => item.id);
