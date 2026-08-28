import { Workspace, WidgetConfig } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const getWidgetConfigService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) return null;

    let widget = await WidgetConfig.findOne({ workspaceId: ws._id }).exec();
    if (!widget) {
        widget = await WidgetConfig.create({
            workspaceId: ws._id,
            name: `${ws.name} Chat Widget`,
            status: "active",
            allowedDomains: [ws.slug + ".com", "localhost", "127.0.0.1"],
            settings: {
                theme: "light",
                primary_color: "#2563eb",
                welcome_message: `Welcome to ${ws.name}! How can we assist you today?`,
            },
        });
    }

    return {
        id: widget._id.toString(),
        name: widget.name,
        status: widget.status,
        allowed_domains: widget.allowedDomains,
        settings: widget.settings,
        branding: widget.settings,
    };
};

export const saveWidgetConfigService = async (systemSlug?: string, payload?: any) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    let widget = await WidgetConfig.findOne({ workspaceId: ws._id }).exec();
    if (!widget) {
        widget = new WidgetConfig({ workspaceId: ws._id });
    }

    if (payload?.name !== undefined) widget.name = payload.name;
    if (payload?.status !== undefined) widget.status = payload.status;
    if (payload?.allowed_domains !== undefined) widget.allowedDomains = payload.allowed_domains;

    if (payload?.settings) {
        widget.settings = {
            theme: payload.settings.theme || widget.settings.theme || "light",
            primary_color: payload.settings.primary_color || widget.settings.primary_color || "#2563eb",
            welcome_message: payload.settings.welcome_message || widget.settings.welcome_message || "",
        };
    }

    await widget.save();
    return getWidgetConfigService(ws.slug);
};

export const deleteWidgetConfigService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (ws) {
        await WidgetConfig.deleteOne({ workspaceId: ws._id }).exec();
    }
    return true;
};

export const getWidgetEmbedScriptService = (systemSlug?: string) => {
    const slug = systemSlug || "default";
    const serverUrl = process.env.SERVER_URL || "http://localhost:5000";
    return `<script>
  (function(w,d,s,o,f,js,fjs){
    w['AI_CHATBOT_CONFIG']={systemSlug:'${slug}',apiUrl:'${serverUrl}'};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src='${serverUrl}/public/widget.js';js.async=1;
    fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ai-chatbot-widget'));
</script>`;
};
