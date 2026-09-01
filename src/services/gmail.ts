import jwt from "jsonwebtoken";
import { GmailConnection, Message, Conversation, Workspace } from "../models/index.js";
import { saveInboundChannelMessage } from "./inboundChannel.js";
import { sendReply } from "./reply.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { getWorkspace } from "./workspaces.js";
import {
    forbiddenError,
    internalServerError,
    notFoundError,
    unprocessableEntityError,
} from "../core/shared/errors/HttpError.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const scopes = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
];

const requireGoogleConfig = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
        throw internalServerError("Gmail OAuth environment configuration is incomplete.");
    }
    return { clientId, clientSecret, redirectUri };
};

const stateSecret = () => process.env.JWT_SECRET?.trim() || process.env.COOKIE_SECRET?.trim() || "gmail_oauth_state";

export const createGmailAuthorizationUrl = async (
    user: AuthenticatedUserContext,
    workspaceIdentifier?: string,
) => {
    const identifier = workspaceIdentifier || user.workspaceId;
    if (!identifier) throw unprocessableEntityError("A workspace is required to connect Gmail.");
    const workspace = await getWorkspace(user, identifier);
    const { clientId, redirectUri } = requireGoogleConfig();
    const state = jwt.sign({ workspaceId: String(workspace.id), purpose: "gmail_oauth" }, stateSecret(), { expiresIn: "10m" });
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: scopes.join(" "),
        state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeAuthorizationCode = async (code: string) => {
    const { clientId, clientSecret, redirectUri } = requireGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) throw unprocessableEntityError(result.error_description || result.error || "Google token exchange failed.");
    return result;
};

const refreshAccessToken = async (connection: any) => {
    if (connection.accessToken && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
        return connection.accessToken as string;
    }
    if (!connection.refreshToken) throw unprocessableEntityError("Gmail refresh token is missing. Reconnect Gmail.");
    const { clientId, clientSecret } = requireGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            refresh_token: connection.refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
        }),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) throw unprocessableEntityError(result.error_description || "Unable to refresh Gmail access token.");
    connection.accessToken = result.access_token;
    connection.tokenExpiresAt = new Date(Date.now() + Number(result.expires_in || 3600) * 1000);
    await connection.save();
    return result.access_token as string;
};

const gmailRequest = async (connection: any, path: string, init?: RequestInit) => {
    const accessToken = await refreshAccessToken(connection);
    const response = await fetch(`${GMAIL_API}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers || {}),
        },
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) throw internalServerError(result?.error?.message || `Gmail API request failed (${response.status}).`);
    return result;
};

export const registerGmailWatch = async (connectionId: string) => {
    const connection = await GmailConnection.findById(connectionId).select("+accessToken +refreshToken").exec();
    if (!connection) throw notFoundError("Gmail connection not found.");
    const topicName = process.env.GOOGLE_PUBSUB_TOPIC?.trim();
    if (!topicName) throw internalServerError("GOOGLE_PUBSUB_TOPIC is required.");
    const watch = await gmailRequest(connection, "/watch", {
        method: "POST",
        body: JSON.stringify({ topicName, labelIds: ["INBOX"], labelFilterBehavior: "INCLUDE" }),
    });
    connection.historyId = String(watch.historyId || "");
    connection.watchExpiration = watch.expiration ? new Date(Number(watch.expiration)) : undefined;
    connection.status = "active";
    connection.errorMessage = "";
    await connection.save();
    return watch;
};

export const completeGmailOAuth = async (code: string, state: string) => {
    let payload: { workspaceId?: string; purpose?: string };
    try {
        payload = jwt.verify(state, stateSecret()) as typeof payload;
    } catch {
        throw forbiddenError("Invalid or expired Gmail OAuth state.");
    }
    if (payload.purpose !== "gmail_oauth" || !payload.workspaceId) throw forbiddenError("Invalid Gmail OAuth state.");
    const workspace = await Workspace.findById(payload.workspaceId).exec();
    if (!workspace) throw notFoundError("Workspace not found.");
    const tokens = await exchangeAuthorizationCode(code);
    const profileResponse = await fetch(`${GMAIL_API}/profile`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile: any = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || !profile.emailAddress) throw internalServerError("Unable to read the connected Gmail profile.");
    const existing = await GmailConnection.findOne({ workspaceId: workspace._id }).select("+refreshToken").exec();
    const connection = existing || new GmailConnection({ workspaceId: workspace._id });
    connection.email = String(profile.emailAddress).toLowerCase();
    connection.accessToken = tokens.access_token;
    if (tokens.refresh_token) connection.refreshToken = tokens.refresh_token;
    connection.tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
    connection.status = "pending";
    await connection.save();
    await registerGmailWatch(String(connection._id));
    return { email: connection.email, status: connection.status };
};

const decodeBase64Url = (value?: string) => value
    ? Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    : "";

const findBody = (part: any): string => {
    if (part?.mimeType === "text/plain" && part?.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part?.parts || []) {
        const body = findBody(child);
        if (body) return body;
    }
    if (part?.body?.data) return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return "";
};

const header = (message: any, name: string) => (message.payload?.headers || [])
    .find((item: any) => String(item.name).toLowerCase() === name.toLowerCase())?.value || "";

const emailFromHeader = (value: string) => value.match(/<([^>]+)>/)?.[1] || value.trim();

export const sendGmailReply = async (conversationId: string, content: string) => {
    const conversation: any = await Conversation.findById(conversationId).exec();
    if (!conversation) throw notFoundError("Gmail conversation not found.");
    const connection = await GmailConnection.findById(conversation.channelAccountId).select("+accessToken +refreshToken").exec();
    if (!connection) throw notFoundError("Gmail connection not found.");
    const metadata = conversation.get("channelMetadata") || {};
    const subject = metadata.subject ? (String(metadata.subject).match(/^re:/i) ? metadata.subject : `Re: ${metadata.subject}`) : "Re: Your message";
    const lines = [
        `To: ${conversation.externalContactId}`,
        `From: ${connection.email}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        ...(metadata.messageId ? [`In-Reply-To: ${metadata.messageId}`, `References: ${metadata.references || metadata.messageId}`] : []),
        "",
        content,
    ];
    const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
    await gmailRequest(connection, "/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw, ...(metadata.threadId ? { threadId: metadata.threadId } : {}) }),
    });
};

export const sendGmailTestMessage = async (
    workspaceId: string,
    recipient: string,
    subject: string,
    content: string,
) => {
    const connection = await GmailConnection.findOne({ workspaceId } as any)
        .select("+accessToken +refreshToken").exec();
    if (!connection) throw notFoundError("Connect Gmail before sending a test message.");
    const cleanRecipient = recipient.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanRecipient)) throw unprocessableEntityError("A valid recipient email is required.");
    if (!subject.trim() || !content.trim()) throw unprocessableEntityError("Subject and message content are required.");
    const raw = Buffer.from([
        `To: ${cleanRecipient}`,
        `From: ${connection.email}`,
        `Subject: ${subject.trim()}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        content.trim(),
    ].join("\r\n"), "utf8").toString("base64url");
    const sent = await gmailRequest(connection, "/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw }),
    });
    return { sent: true, message_id: sent.id, thread_id: sent.threadId, recipient: cleanRecipient };
};

const processGmailMessage = async (connection: any, workspace: any, messageId: string) => {
    const gmailMessage = await gmailRequest(connection, `/messages/${encodeURIComponent(messageId)}?format=full`);
    if (!(gmailMessage.labelIds || []).includes("INBOX")) return;
    const from = emailFromHeader(header(gmailMessage, "From")).toLowerCase();
    if (!from || from === connection.email.toLowerCase()) return;
    const content = findBody(gmailMessage.payload) || gmailMessage.snippet || "[Email without text body]";
    const saved = await saveInboundChannelMessage({
        systemSlug: workspace.slug,
        receivedFrom: "gmail",
        externalContactId: from,
        channelAccountId: String(connection._id),
        externalMessageId: gmailMessage.id,
        content,
        visitor: { name: header(gmailMessage, "From") || from, email: from },
    });
    if (saved.duplicate || !saved.conversation) return;
    saved.conversation.set("channelMetadata", {
        subject: header(gmailMessage, "Subject"),
        messageId: header(gmailMessage, "Message-ID"),
        references: header(gmailMessage, "References"),
        threadId: gmailMessage.threadId,
    });
    await saved.conversation.save();
    await sendReply({
        type: "ai",
        conversationId: String(saved.conversation._id),
        inboundMessageId: String(saved.message._id),
        systemSlug: workspace.slug,
        channel: "gmail",
        deliver: (replyText) => sendGmailReply(String(saved.conversation!._id), replyText),
    });
};

export const handleGmailPubSub = async (body: any, verificationToken?: string) => {
    if (!process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN || verificationToken !== process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN) {
        throw forbiddenError("Invalid Gmail Pub/Sub verification token.");
    }
    const encoded = body?.message?.data;
    if (!encoded) return;
    const notice = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    const connection = await GmailConnection.findOne({ email: String(notice.emailAddress || "").toLowerCase() })
        .select("+accessToken +refreshToken").exec();
    if (!connection) return;
    const workspace = await Workspace.findById(connection.workspaceId).exec();
    if (!workspace) return;
    const startHistoryId = connection.historyId;
    if (!startHistoryId) {
        connection.historyId = String(notice.historyId || "");
        await connection.save();
        return;
    }
    const history = await gmailRequest(connection, `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded&labelId=INBOX`);
    const ids = new Set<string>();
    for (const record of history.history || []) {
        for (const added of record.messagesAdded || []) if (added.message?.id) ids.add(added.message.id);
    }
    for (const id of ids) await processGmailMessage(connection, workspace, id);
    connection.historyId = String(history.historyId || notice.historyId || connection.historyId);
    connection.status = "active";
    connection.errorMessage = "";
    await connection.save();
};

export const getGmailStatus = async (workspaceId: string) => {
    const connection = await GmailConnection.findOne({ workspaceId }).lean().exec();
    return connection ? {
        connected: connection.status === "active",
        email: connection.email,
        status: connection.status,
        watch_expiration: connection.watchExpiration,
        error_message: connection.errorMessage,
    } : { connected: false, status: "disconnected" };
};

export const disconnectGmail = async (workspaceId: string) => {
    const connection = await GmailConnection.findOne({ workspaceId }).select("+accessToken +refreshToken").exec();
    if (!connection) return;
    await gmailRequest(connection, "/stop", { method: "POST" }).catch(() => undefined);
    await connection.deleteOne();
};

export const renewExpiringGmailWatches = async () => {
    const threshold = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const connections = await GmailConnection.find({
        $or: [
            { watchExpiration: { $lte: threshold } },
            { watchExpiration: { $exists: false } },
            { status: { $ne: "active" } },
        ],
    }).select("_id").lean().exec();
    const results = [];
    for (const connection of connections) {
        try {
            await registerGmailWatch(String(connection._id));
            results.push({ id: String(connection._id), renewed: true });
        } catch (error: any) {
            await GmailConnection.findByIdAndUpdate(connection._id, {
                status: "error",
                errorMessage: error.message || "Gmail watch renewal failed.",
            });
            results.push({ id: String(connection._id), renewed: false });
        }
    }
    return results;
};
