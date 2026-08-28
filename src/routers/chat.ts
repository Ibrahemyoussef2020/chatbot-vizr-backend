import { Router } from "express";
import { publicChatController } from "../controllers/index.js";
import { publicRateLimit } from "../middlewares/publicRateLimit.middleware.js";
import validateRequest from "../middlewares/validateRequest.middleware.js";
import { createPublicConversationValidator } from "../validator/index.js";

const chatsRouter = Router();

chatsRouter.use(publicRateLimit);
chatsRouter.post(
    "/thread/create",
    createPublicConversationValidator,
    validateRequest,
    publicChatController.create,
);
chatsRouter.post("/", publicChatController.send);
chatsRouter.get("/:id/messages", publicChatController.messages);
chatsRouter.post("/:id/end", publicChatController.end);
export default chatsRouter;
