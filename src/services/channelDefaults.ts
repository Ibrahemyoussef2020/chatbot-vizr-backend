import WhatsAppConfig from "../models/WhatsAppConfig.js";
import TelegramBot from "../models/TelegramBot.js";
import GmailConnection from "../models/GmailConnection.js";
import Workspace from "../models/Workspace.js";
import MetaChannelConfig from "../models/MetaChannelConfig.js";

// Copy only account settings. Workspace ownership and custom settings stay local.
export const ensureWorkspaceChannelDefaults = async (workspaceId: unknown) => {
    const id = String(workspaceId);
    const workspace = await Workspace.findById(id).select("disabledChannelDefaults").lean().exec();
    const disabled = workspace?.disabledChannelDefaults || [];
    const whatsapp = await WhatsAppConfig.findOne({ whatsapp_phone_number_id: { $nin: ["", null] } }).sort({ createdAt: 1, _id: 1 }).lean().exec();
    if (whatsapp && !disabled.includes("whatsapp")) {
        const { _id, workspaceId: _workspace, createdAt, updatedAt, __v, ...settings } = whatsapp;
        await WhatsAppConfig.updateOne({ workspaceId: id }, { $setOnInsert: { ...settings, workspaceId: id } }, { upsert: true });
    }
    const telegram = await TelegramBot.findOne({ telegram_bot_id: { $nin: ["", null] }, bot_token: { $nin: ["", null], $not: /demo/i } }).sort({ status: 1, createdAt: 1, _id: 1 }).select("+bot_token +webhook_secret").lean().exec();
    if (telegram && !disabled.includes("telegram")) {
        const { _id, workspaceId: _workspace, createdAt, updatedAt, __v, ...settings } = telegram;
        await TelegramBot.updateOne({ workspaceId: id, telegram_bot_id: telegram.telegram_bot_id }, { $setOnInsert: { ...settings, workspaceId: id } }, { upsert: true });
    }
    const gmail = await GmailConnection.findOne({ refreshToken: { $nin: ["", null] } }).sort({ createdAt: 1, _id: 1 }).select("+accessToken +refreshToken").lean().exec();
    if (gmail && !disabled.includes("gmail")) {
        const { _id, workspaceId: _workspace, createdAt, updatedAt, __v, ...settings } = gmail;
        await GmailConnection.updateOne({ workspaceId: id }, { $setOnInsert: { ...settings, workspaceId: id } }, { upsert: true });
    }
    const instagram = await MetaChannelConfig.findOne({ status: "active" }).sort({ createdAt: 1, _id: 1 }).select("+pageAccessToken +appSecret +verifyToken").lean().exec();
    if (instagram && !disabled.includes("instagram")) {
        const { _id, workspaceId: _workspace, createdAt, updatedAt, __v, ...settings } = instagram;
        await MetaChannelConfig.updateOne({ workspaceId: id, instagramAccountId: instagram.instagramAccountId }, { $setOnInsert: { ...settings, workspaceId: id } }, { upsert: true });
    }
};

export const sharedChannelConversationScopes = async (workspaceId: unknown) => {
    const id = String(workspaceId);
    const scopes: Record<string, unknown>[] = [];
    const whatsapp = await WhatsAppConfig.findOne({ workspaceId: id }).lean().exec();
    if (whatsapp?.whatsapp_phone_number_id) scopes.push({ receivedFrom: "whatsapp", channelAccountId: whatsapp.whatsapp_phone_number_id });
    const bots = await TelegramBot.find({ workspaceId: id }).lean().exec();
    const botIds = bots.map(bot => bot.telegram_bot_id).filter((id): id is string => Boolean(id));
    if (botIds.length) {
        const linked = await TelegramBot.find({ telegram_bot_id: { $in: botIds } }).select("_id").lean().exec();
        scopes.push({ receivedFrom: "telegram", channelAccountId: { $in: linked.map(bot => String(bot._id)) } });
    }
    const gmail = await GmailConnection.findOne({ workspaceId: id }).lean().exec();
    if (gmail?.email) {
        const linked = await GmailConnection.find({ email: gmail.email }).select("_id").lean().exec();
        scopes.push({ receivedFrom: "gmail", channelAccountId: { $in: [gmail.email, ...linked.map(connection => String(connection._id))] } });
    }
    const instagram = await MetaChannelConfig.find({ workspaceId: id }).lean().exec();
    if (instagram.length) {
        const linked = await MetaChannelConfig.find({ instagramAccountId: { $in: instagram.map(config => config.instagramAccountId) } }).select("_id").lean().exec();
        scopes.push({ receivedFrom: "instagram", channelAccountId: { $in: linked.map(config => String(config._id)) } });
    }
    return scopes;
};

export const initializeAllWorkspaceChannelDefaults = async () => {
    const workspaces = await Workspace.find({}).select("_id").lean().exec();
    for (const workspace of workspaces) await ensureWorkspaceChannelDefaults(workspace._id);
    return workspaces.length;
};
