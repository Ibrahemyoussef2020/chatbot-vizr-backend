import { Router } from "express";
import authRouter from "./auth.js";
import chatsRouter from "./chat.js";
import userRouter from "./user.js";
import landingRouter from "./landing.js";
import workspaceRouter from "./workspace.js";
import subscriptionRouter from "./subscription.js";

import { whatsappWebhookController } from "../controllers/index.js";

const appRouter = Router();

// Public Webhook endpoints for Meta WhatsApp
appRouter.get("/whatsapp/webhook", whatsappWebhookController.verifyWhatsAppWebhook);
appRouter.post("/whatsapp/webhook", whatsappWebhookController.handleWhatsAppWebhookEvent);

appRouter.use("/auth", authRouter);
appRouter.use("/users", userRouter);
appRouter.use("/landing", landingRouter);
appRouter.use("/system/chat", chatsRouter);
appRouter.use("/chats", chatsRouter);
appRouter.use("/chat", chatsRouter);

appRouter.use("/admin", workspaceRouter);
appRouter.use("/subscription", subscriptionRouter);

export default appRouter;
