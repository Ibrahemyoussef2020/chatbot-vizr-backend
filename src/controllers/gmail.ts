import type { Request, Response } from "express";
import { waitUntil } from "@vercel/functions";
import { getWorkspace } from "../services/workspaces.js";
import {
    completeGmailOAuth,
    createGmailAuthorizationUrl,
    disconnectGmail,
    getGmailStatus,
    handleGmailPubSub,
    registerGmailWatch,
    renewExpiringGmailWatches,
    sendGmailTestMessage,
    verifyGmailPubSubToken,
} from "../services/gmail.js";
import { GmailConnection } from "../models/index.js";
import { unauthorizedError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";

const errorStatus = (error: any, fallback = 500) => Number(error?.statusCode || fallback);

const workspaceForRequest = async (req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user) throw unauthorizedError();
    const requested = String(req.query.system_slug || req.query.workspace || user.workspaceId || "");
    if (!requested) throw unprocessableEntityError("A workspace is required.");
    return getWorkspace(user, requested);
};

export const connect = async (req: Request, res: Response) => {
    try {
        const user = res.locals.user;
        if (!user) throw unauthorizedError();
        const url = await createGmailAuthorizationUrl(
            user,
            String(req.query.system_slug || req.query.workspace || user.workspaceId || ""),
        );
        res.json({ success: true, data: { authorization_url: url } });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ success: false, message: error.message || "Unable to start Gmail OAuth." });
    }
};

export const callback = async (req: Request, res: Response) => {
    const frontend = (process.env.FRONTEND_URL || process.env.DOMAIN || "").replace(/\/$/, "");
    try {
        const code = String(req.query.code || "");
        const state = String(req.query.state || "");
        if (!code || !state) throw unprocessableEntityError(String(req.query.error || "Missing Google authorization response."));
        const result = await completeGmailOAuth(code, state);
        if (frontend.startsWith("http")) {
            res.redirect(`${frontend}/dashboard/settings/channels/gmail?connected=1`);
            return;
        }
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        const message = error.message || "Unknown OAuth error";
        if (frontend.startsWith("http")) {
            res.redirect(`${frontend}/dashboard/settings/channels/gmail?error=${encodeURIComponent(message)}`);
            return;
        }
        res.status(errorStatus(error, 400)).send(`Gmail connection failed: ${message}`);
    }
};

export const webhook = async (req: Request, res: Response) => {
    const verificationToken = String(req.query.token || "");

    try {
        verifyGmailPubSubToken(verificationToken);
    } catch (error: any) {
        console.error("[Gmail Pub/Sub Error]", error.message);
        res.status(errorStatus(error, 403)).send("ERROR");
        return;
    }

    const processing = handleGmailPubSub(req.body, verificationToken)
        .catch((error: any) => {
            console.error("[Gmail Pub/Sub Processing Error]", error.message);
        });
    waitUntil(processing);
    res.status(204).send();
};

export const status = async (req: Request, res: Response) => {
    try {
        const workspace = await workspaceForRequest(req, res);
        res.json({ success: true, data: await getGmailStatus(String(workspace.id)) });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ success: false, message: error.message || "Unable to read Gmail status." });
    }
};

export const renewWatch = async (req: Request, res: Response) => {
    try {
        const workspace = await workspaceForRequest(req, res);
        const connection = await GmailConnection.findOne({ workspaceId: workspace.id } as any).exec();
        if (!connection) throw unprocessableEntityError("Connect Gmail first.");
        res.json({ success: true, data: await registerGmailWatch(String(connection._id)) });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ success: false, message: error.message || "Unable to renew Gmail watch." });
    }
};

export const disconnect = async (req: Request, res: Response) => {
    try {
        const workspace = await workspaceForRequest(req, res);
        await disconnectGmail(String(workspace.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ success: false, message: error.message || "Unable to disconnect Gmail." });
    }
};

export const testMessage = async (req: Request, res: Response) => {
    try {
        const workspace = await workspaceForRequest(req, res);
        const { recipient, subject, content } = req.body || {};
        const result = await sendGmailTestMessage(
            String(workspace.id),
            String(recipient || ""),
            String(subject || ""),
            String(content || ""),
        );
        res.json({ success: true, data: result, message: "Gmail test message sent." });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ success: false, message: error.message || "Unable to send Gmail test message." });
    }
};

export const cronRenewWatches = async (req: Request, res: Response) => {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || req.get("Authorization") !== `Bearer ${secret}`) {
        res.status(401).json({ success: false, message: "Unauthorized cron request." });
        return;
    }
    const results = await renewExpiringGmailWatches();
    res.json({ success: true, renewed: results.filter((item) => item.renewed).length, total: results.length });
};
