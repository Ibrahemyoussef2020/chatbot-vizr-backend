import { Router } from "express";
import authRouter from "./auth.js";
import chatsRouter from "./chat.js";
import userRouter from "./user.js";
import landingRouter from "./landing.js";
import workspaceRouter from "./workspace.js";
import subscriptionRouter from "./subscription.js";
import { whatsappWebhookController, telegramBotController, gmailController, publicChatController, knowledgeBaseController, instagramWebhookController } from "../controllers/index.js";
import { publicRateLimit } from "../middlewares/publicRateLimit.middleware.js";

const appRouter = Router();

// Public Webhook endpoints for Meta WhatsApp
appRouter.get("/whatsapp/webhook", whatsappWebhookController.verifyWhatsAppWebhook);
appRouter.post("/whatsapp/webhook", whatsappWebhookController.handleWhatsAppWebhookEvent);
appRouter.post("/telegram/webhook/:id", telegramBotController.handleTelegramWebhook);
appRouter.get("/instagram/webhook", instagramWebhookController.verify);
appRouter.post("/instagram/webhook", instagramWebhookController.handle);
appRouter.get("/google/callback", gmailController.callback);
appRouter.post("/gmail/webhook", gmailController.webhook);
appRouter.get("/gmail/cron/renew", gmailController.cronRenewWatches);
appRouter.get("/knowledge/shared/:token", knowledgeBaseController.showSharedOutput);

appRouter.use("/auth", authRouter);
appRouter.use("/users", userRouter);
appRouter.use("/landing", landingRouter);

// Direct public chat route bindings (guarantees matching with or without trailing slash)
appRouter.post("/system/chat", publicRateLimit, publicChatController.send);
appRouter.post("/system/chat/send", publicRateLimit, publicChatController.send);
appRouter.post("/system/chat/thread/create", publicRateLimit, publicChatController.create);
appRouter.post("/chats", publicRateLimit, publicChatController.send);
appRouter.post("/chat", publicRateLimit, publicChatController.send);


appRouter.use("/system/chat", chatsRouter);
appRouter.use("/chats", chatsRouter);
appRouter.use("/chat", chatsRouter);


appRouter.use("/admin", workspaceRouter);
appRouter.use("/subscription", subscriptionRouter);

export default appRouter;
