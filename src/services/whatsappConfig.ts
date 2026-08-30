import { SystemLog, Workspace, WhatsAppConfig } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const getWhatsAppConfigService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) return null;

    let config = await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) {
        config = await WhatsAppConfig.create({
            workspaceId: ws._id,
            provider: "meta",
            ai_engine_type: "openai_api",
            internal_server_url: "http://localhost:11434/v1",
            openai_api_key: process.env.OPENAI_API_KEY || "sk-proj-demo-whatsapp-key",
            whatsapp_app_secret: process.env.WHATSAPP_APP_SECRET || "meta_app_secret_demo",
            whatsapp_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || "109876543210985",
            whatsapp_verify_token: process.env.WHATSAPP_CHANNEL_VERIFY || process.env.WHATSAPP_VERIFY_TOKEN || "vizr_wa_webhook_verify_token_2026",
            whatsapp_waba_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WHATSAPP_WABA_ID || "waba_account_998877",
            whatsapp_access_token: process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "EAAXdemo_system_user_token_long_lived",
            openwa_api_url: "http://localhost:8080",
            openwa_api_key: "openwa_key_secret_2026",
            openwa_session_id: "main_session",
            sessions: [
                { session_id: "main_session", status: "connected", phone: "+201554605666" },
                { session_id: "support_gateway", status: "qr_ready", phone: "+201009876543" },
            ],
            qr_code_url: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WABA_OPENWA_SESSION_LINK",
        });
    }

    return {
        id: config._id.toString(),
        workspace_id: ws._id.toString(),
        system_slug: ws.slug,
        provider: config.provider,
        ai_engine_type: config.ai_engine_type,
        internal_server_url: config.internal_server_url,
        openai_api_key: config.openai_api_key,
        whatsapp_app_secret: config.whatsapp_app_secret,
        whatsapp_phone_number_id: config.whatsapp_phone_number_id,
        whatsapp_verify_token: config.whatsapp_verify_token,
        whatsapp_waba_id: config.whatsapp_waba_id,
        whatsapp_access_token: config.whatsapp_access_token,
        openwa_api_url: config.openwa_api_url,
        openwa_api_key: config.openwa_api_key,
        openwa_session_id: config.openwa_session_id,
        sessions: config.sessions || [],
        qr_code_url: config.qr_code_url || "",
    };
};

export const saveWhatsAppConfigService = async (systemSlug?: string, payload?: any) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    let config = await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) {
        config = new WhatsAppConfig({ workspaceId: ws._id });
    }

    if (payload?.provider) config.provider = payload.provider;
    if (payload?.ai_engine_type) config.ai_engine_type = payload.ai_engine_type;
    if (payload?.internal_server_url !== undefined) config.internal_server_url = payload.internal_server_url;
    if (payload?.openai_api_key !== undefined) config.openai_api_key = payload.openai_api_key;
    if (payload?.whatsapp_app_secret !== undefined) config.whatsapp_app_secret = payload.whatsapp_app_secret;
    if (payload?.whatsapp_phone_number_id !== undefined) config.whatsapp_phone_number_id = payload.whatsapp_phone_number_id;
    if (payload?.whatsapp_verify_token !== undefined) config.whatsapp_verify_token = payload.whatsapp_verify_token;
    if (payload?.whatsapp_waba_id !== undefined) config.whatsapp_waba_id = payload.whatsapp_waba_id;
    if (payload?.whatsapp_access_token !== undefined) config.whatsapp_access_token = payload.whatsapp_access_token;
    if (payload?.openwa_api_url !== undefined) config.openwa_api_url = payload.openwa_api_url;
    if (payload?.openwa_api_key !== undefined) config.openwa_api_key = payload.openwa_api_key;
    if (payload?.openwa_session_id !== undefined) config.openwa_session_id = payload.openwa_session_id;

    await config.save();
    return getWhatsAppConfigService(ws.slug);
};

export const createOpenWASessionService = async (systemSlug?: string, sessionId?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    const config = await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) throw new Error("WhatsApp config not found.");

    const sId = sessionId || `session_${Date.now()}`;
    const exists = config.sessions.some((s) => s.session_id === sId);
    if (!exists) {
        config.sessions.push({ session_id: sId, status: "connected", phone: "+20100000000" });
        await config.save();
    }

    return config.sessions;
};

export const deleteOpenWASessionService = async (systemSlug?: string, sessionId?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    const config = await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) throw new Error("WhatsApp config not found.");

    config.sessions = config.sessions.filter((s) => s.session_id !== sessionId);
    await config.save();

    return config.sessions;
};

export const getOpenWAQRService = (systemSlug?: string) => {
    const slug = systemSlug || "workspace";
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=OPENWA_GATEWAY_LINK_${slug.toUpperCase()}_${Date.now()}`;
};

export const getWhatsAppTemplatesService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    const config = ws ? await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec() : null;
    if (!config?.whatsapp_waba_id || !config.whatsapp_access_token) {
        throw new Error("Meta WABA ID and Access Token are required.");
    }

    const url = `https://graph.facebook.com/v18.0/${config.whatsapp_waba_id}/message_templates?fields=name,status,language,category,components&limit=100`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.whatsapp_access_token}` } });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Meta Cloud API Error: ${result?.error?.message || response.statusText}`);

    return (result.data || [])
        .filter((template: any) => {
            if (template.status !== "APPROVED") return false;
            const components = template.components || [];
            const needsMedia = components.some((component: any) =>
                component.type === "CAROUSEL" ||
                (component.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format)),
            );
            return !needsMedia;
        })
        .map((template: any) => {
            const body = (template.components || []).find((component: any) => component.type === "BODY")?.text || "";
            const parameterCount = Math.max(0, ...Array.from(body.matchAll(/\{\{(\d+)\}\}/g), (match: any) => Number(match[1])));
            return {
                name: template.name,
                language: template.language,
                category: template.category,
                body,
                parameter_count: parameterCount,
            };
        });
};

export const getWhatsAppConversationStatusService = async (phone: string, systemSlug?: string) => {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (!cleanPhone) throw new Error("A recipient phone number is required.");
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    const latestInbound: any = await SystemLog.findOne({
        systemSlug: ws.slug,
        category: "whatsapp-inbound",
        "metadata.phone": cleanPhone,
    }).sort({ createdAt: -1 }).lean().exec();
    const repliedAt = latestInbound?.createdAt ? new Date(latestInbound.createdAt) : null;
    const windowExpiresAt = repliedAt ? new Date(repliedAt.getTime() + 24 * 60 * 60 * 1000) : null;

    return {
        phone: cleanPhone,
        replied: Boolean(windowExpiresAt && windowExpiresAt.getTime() > Date.now()),
        latest_message: latestInbound?.metadata?.text || null,
        replied_at: repliedAt?.toISOString() || null,
        window_expires_at: windowExpiresAt?.toISOString() || null,
    };
};

export const sendWhatsAppTestMessageService = async (
    phone: string,
    text: string,
    systemSlug?: string,
    options?: { mode?: "text" | "template"; templateName?: string; templateLanguage?: string; templateParameters?: string[] },
) => {
    const ws = await resolveWorkspace(systemSlug);
    const config = ws ? await WhatsAppConfig.findOne({ workspaceId: ws._id }).exec() : null;

    if (!config) {
        throw new Error("WhatsApp configuration not found for workspace.");
    }

    const aiEngine = config.ai_engine_type === "internal_server" ? `Internal Server (${config.internal_server_url})` : "OpenAI API Key";
    const cleanPhone = phone.replace(/\D/g, "");

    if (!cleanPhone) {
        throw new Error("Invalid recipient phone number. Please enter digits including country code (e.g. 201554605666).");
    }

    const provider = config.provider || "meta";

    if (provider === "meta") {
        const phoneId = config.whatsapp_phone_number_id;
        const accessToken = config.whatsapp_access_token;

        if (!phoneId || !accessToken || phoneId.includes("demo") || accessToken.includes("demo")) {
            throw new Error(
                "Meta Cloud API credentials are using demo placeholder values. Please enter your Meta Phone Number ID and Access Token in Platform Configurations."
            );
        }

        const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
        const mode = options?.mode || "text";
        const templateName = options?.templateName?.trim() || "hello_world";
        const templateLanguage = options?.templateLanguage?.trim() || "en_US";
        const templateParameters = (options?.templateParameters || []).map((value) => ({ type: "text", text: String(value) }));
        const payload = mode === "template"
            ? {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanPhone,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: templateLanguage },
                    ...(templateParameters.length ? { components: [{ type: "body", parameters: templateParameters }] } : {}),
                },
            }
            : {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanPhone,
                type: "text",
                text: { preview_url: false, body: text },
            };

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const resData: any = await res.json().catch(() => ({}));

        if (!res.ok) {
            const metaErr = resData?.error?.message || resData?.error?.error_data?.details || `HTTP ${res.status}: ${res.statusText}`;
            throw new Error(`Meta Cloud API Error: ${metaErr}`);
        }

        return {
            sent: true,
            message_id: resData?.messages?.[0]?.id || "unknown",
            phone: cleanPhone,
            text,
            mode,
            template_name: mode === "template" ? templateName : undefined,
            provider: "meta",
            routed_via_ai_engine: aiEngine,
            timestamp: new Date().toISOString(),
        };
    } else {
        // OpenWA Gateway
        const openwaUrl = (config.openwa_api_url || "http://localhost:8080").replace(/\/$/, "");
        const apiKey = config.openwa_api_key;

        const res = await fetch(`${openwaUrl}/sendText`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                to: `${cleanPhone}@c.us`,
                content: text,
            }),
        });

        const resData: any = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(`OpenWA Gateway Error: ${resData?.message || `HTTP ${res.status}: ${res.statusText}`}`);
        }

        return {
            sent: true,
            phone: cleanPhone,
            text,
            provider: "openwa",
            routed_via_ai_engine: aiEngine,
            timestamp: new Date().toISOString(),
        };
    }
};
