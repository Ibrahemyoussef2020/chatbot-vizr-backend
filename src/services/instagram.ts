import { MetaChannelConfig, Workspace } from "../models/index.js";
import { saveInboundChannelMessage } from "./inboundChannel.js";
import { enqueueChannelReply } from "./channelReplyJobs.js";
import { z } from "zod";

const instagramEnvelopeSchema = z.object({
    object: z.literal("instagram"),
    entry: z.array(z.object({
        id: z.union([z.string(), z.number()]),
        messaging: z.array(z.record(z.string(), z.any())).optional().default([]),
    }).passthrough()),
}).passthrough();

export const verifyInstagramWebhook = async (mode?: string, token?: string, challenge?: string) => {
    if (mode !== "subscribe" || !token || !challenge) throw new Error("Invalid Instagram webhook verification request.");
    const environmentMatch = token === process.env.META_VERIFY_TOKEN?.trim();
    const databaseMatch = Boolean(await MetaChannelConfig.exists({ verifyToken: token, status: "active" }));
    if (!environmentMatch && !databaseMatch) throw new Error("Invalid Instagram webhook verification token.");
    return challenge;
};

export const ingestInstagramWebhook = async (body: any) => {
    if (body?.object !== "instagram") return;
    body = instagramEnvelopeSchema.parse(body);
    for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
            const externalEventId = String(event?.message?.mid || "");
            const senderId = String(event?.sender?.id || "");
            const accountId = String(event?.recipient?.id || entry.id || "");
            const text = String(event?.message?.text || "").trim();
            if (!externalEventId || !senderId || !accountId || !text || event?.message?.is_echo) continue;
            const config = await MetaChannelConfig.findOne({ instagramAccountId: accountId, status: "active" }).exec();
            if (!config) continue;
            const workspace = await Workspace.findById(config.workspaceId).exec();
            if (!workspace) continue;
            const saved = await saveInboundChannelMessage({
                systemSlug: workspace.slug,
                receivedFrom: "instagram",
                externalContactId: senderId,
                channelAccountId: String(config._id),
                externalMessageId: externalEventId,
                content: text,
                visitor: { name: `Instagram ${senderId}` },
            });
            if (!saved.conversation) throw new Error("Instagram conversation could not be resolved.");
            await enqueueChannelReply({
                eventId: externalEventId,
                channel: "instagram",
                conversationId: String(saved.conversation._id),
                inboundMessageId: String(saved.message._id),
                systemSlug: workspace.slug,
                recipientId: senderId,
                channelAccountId: String(config._id),
            });
        }
    }
};

export const sendInstagramReply = async (configId: string, recipientId: string, content: string) => {
    const config = await MetaChannelConfig.findById(configId).select("+pageAccessToken").exec();
    if (!config || config.status !== "active") throw new Error("Instagram channel configuration is unavailable.");
    const version = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${config.pageId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.pageAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text: content } }),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Instagram API Error: ${result?.error?.message || response.statusText}`);
    return result;
};
