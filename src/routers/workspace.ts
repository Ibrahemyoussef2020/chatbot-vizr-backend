import { Router } from "express";
import multer from "multer";
import {
    workspaceController,
    tokenLogController,
    tagController,
    systemLogController,
    chatbotConfigController,
    aiConfigController,
    widgetConfigController,
    securityRoleController,
    whatsappConfigController,
    telegramBotController,
    dashboardOverviewController,
    dashboardAnalyticsController,
    threadManagementController,
    gmailController,
    knowledgeBaseController,
    channelJobsController,
} from "../controllers/index.js";
import { authenticate, validateRequest } from "../middlewares/index.js";
import { createWorkspaceValidator, updateWorkspaceValidator } from "../validator/index.js";

const workspaceRouter = Router();
const knowledgeUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024,
        files: 10,
    },
});

workspaceRouter.use(authenticate);
workspaceRouter.get("/channel-jobs/failed", channelJobsController.failed);
workspaceRouter.post("/channel-jobs/:id/retry", channelJobsController.retry);

// Workspace Systems
workspaceRouter.get("/systems-list", workspaceController.list);
workspaceRouter.post(
    "/systems-mgmt",
    createWorkspaceValidator,
    validateRequest,
    workspaceController.store,
);

// Dashboard Overview & Analytics
workspaceRouter.get("/stats", dashboardOverviewController.overview);
workspaceRouter.get("/threads/time", dashboardAnalyticsController.analytics);
workspaceRouter.get("/analytics", dashboardAnalyticsController.analytics);

// Thread Management
workspaceRouter.get("/threads", threadManagementController.threadsList);
workspaceRouter.get("/threads/:id/messages", threadManagementController.threadMessages);
workspaceRouter.post("/assign-thread", threadManagementController.assignThread);
workspaceRouter.post("/reply-thread", threadManagementController.replyThread);
workspaceRouter.put("/threads/:id", threadManagementController.updateThread);
workspaceRouter.put("/threads/:id/sidebar", threadManagementController.updateSidebar);

// Token Telemetry
workspaceRouter.get("/analytics/tokens", tokenLogController.analytics);
workspaceRouter.get("/analytics/tokens/logs/:apiKeyId", tokenLogController.apiKeyLogs);
workspaceRouter.get("/tokens", tokenLogController.analytics);

// Tags Management
workspaceRouter.get("/tags", tagController.index);
workspaceRouter.post("/tags", tagController.create);
workspaceRouter.put("/tags/:id", tagController.edit);
workspaceRouter.delete("/tags/:id", tagController.remove);

// System Logs
workspaceRouter.get("/logs", systemLogController.list);
workspaceRouter.get("/logs/download", systemLogController.exportLogs);

// Chatbot Info Config
workspaceRouter.get("/chatbot/config", chatbotConfigController.getChatbotConfig);
workspaceRouter.put("/chatbot/config", chatbotConfigController.updateChatbotConfig);

// AI Website Configs
workspaceRouter.get("/ai-configs", aiConfigController.getAIConfig);
workspaceRouter.post("/ai-configs", aiConfigController.saveAIConfig);
workspaceRouter.put("/ai-configs/:id", aiConfigController.saveAIConfig);
workspaceRouter.delete("/ai-configs/:id", aiConfigController.deleteAIConfig);

// Widget Customizer Configs
workspaceRouter.get("/widgets-mgmt", widgetConfigController.getWidgetConfig);
workspaceRouter.post("/widgets-mgmt", widgetConfigController.saveWidgetConfig);
workspaceRouter.put("/widgets-mgmt/:id", widgetConfigController.saveWidgetConfig);
workspaceRouter.delete("/widgets-mgmt", widgetConfigController.deleteWidgetConfig);
workspaceRouter.get("/widgets-mgmt/embed-script", widgetConfigController.getWidgetEmbedScript);

// WhatsApp Channel Configs & OpenWA Gateway
workspaceRouter.get("/whatsapp/config", whatsappConfigController.getWhatsAppConfig);
workspaceRouter.post("/whatsapp/config", whatsappConfigController.saveWhatsAppConfig);
workspaceRouter.get("/whatsapp/templates", whatsappConfigController.getWhatsAppTemplates);
workspaceRouter.get("/whatsapp/conversation-status", whatsappConfigController.getWhatsAppConversationStatus);
workspaceRouter.get("/whatsapp/connection-status", whatsappConfigController.getWhatsAppConnectionStatus);
workspaceRouter.get("/whatsapp/openwa/qr", whatsappConfigController.getOpenWAQR);
workspaceRouter.post("/whatsapp/openwa/sessions", whatsappConfigController.createOpenWASession);
workspaceRouter.delete("/whatsapp/openwa/sessions/:sessionId", whatsappConfigController.deleteOpenWASession);
workspaceRouter.post("/whatsapp/test-message", whatsappConfigController.sendWhatsAppTestMessage);

// Telegram Channel Bots & Webhooks
workspaceRouter.get("/telegram/bots", telegramBotController.listTelegramBots);
workspaceRouter.post("/telegram/bots", telegramBotController.createTelegramBot);
workspaceRouter.post("/telegram/bots/:id/webhook", telegramBotController.refreshTelegramWebhook);
workspaceRouter.delete("/telegram/bots/:id", telegramBotController.deleteTelegramBot);
workspaceRouter.post("/telegram/bots/:id/test-message", telegramBotController.sendTelegramTestMessage);

// Gmail OAuth, mailbox watch, and connection state
workspaceRouter.get("/gmail/connect", gmailController.connect);
workspaceRouter.get("/gmail/status", gmailController.status);
workspaceRouter.post("/gmail/watch", gmailController.renewWatch);
workspaceRouter.delete("/gmail/disconnect", gmailController.disconnect);
workspaceRouter.post("/gmail/test-message", gmailController.testMessage);

// Knowledge Base sessions, sources, and grounded chat
workspaceRouter.get("/knowledge/outputs/saved", knowledgeBaseController.listSavedOutputs);
workspaceRouter.get("/knowledge/sessions", knowledgeBaseController.listSessions);
workspaceRouter.post("/knowledge/sessions", knowledgeBaseController.createSession);
workspaceRouter.get("/knowledge/sessions/:id", knowledgeBaseController.showSession);
workspaceRouter.post(
    "/knowledge/sessions/:id/sources",
    knowledgeUpload.array("files", 10),
    knowledgeBaseController.uploadSources,
);
workspaceRouter.post("/knowledge/sessions/:id/chat", knowledgeBaseController.chat);
workspaceRouter.post("/knowledge/sessions/:id/uploads/initiate", knowledgeBaseController.initiateUpload);
workspaceRouter.post("/knowledge/sessions/:id/uploads/:uploadId/refresh", knowledgeBaseController.refreshUpload);
workspaceRouter.patch("/knowledge/sessions/:id/uploads/:uploadId/progress", knowledgeBaseController.uploadProgress);
workspaceRouter.post("/knowledge/sessions/:id/uploads/:uploadId/complete", knowledgeBaseController.completeUpload);
workspaceRouter.delete("/knowledge/sessions/:id/uploads/:uploadId", knowledgeBaseController.cancelUpload);
workspaceRouter.get("/knowledge/sessions/:id/outputs/:kind", knowledgeBaseController.listOutputs);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind", knowledgeBaseController.saveOutput);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind/generate", knowledgeBaseController.generateOutput);
workspaceRouter.get("/knowledge/sessions/:id/outputs/:kind/:outputId", knowledgeBaseController.showOutput);
workspaceRouter.patch("/knowledge/sessions/:id/outputs/:kind/:outputId/saved", knowledgeBaseController.saveOutputFavorite);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind/:outputId/regenerate", knowledgeBaseController.regenerateOutput);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind/:outputId/share", knowledgeBaseController.shareOutput);
workspaceRouter.delete("/knowledge/sessions/:id/outputs/:kind/:outputId/share", knowledgeBaseController.unshareOutput);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind/:outputId/schemas", knowledgeBaseController.createOutputSchema);
workspaceRouter.get("/knowledge/sessions/:id/outputs/:kind/:outputId/schemas/:schemaId", knowledgeBaseController.showOutputSchema);
workspaceRouter.patch("/knowledge/sessions/:id/outputs/:kind/:outputId/schemas/:schemaId", knowledgeBaseController.editOutputSchema);
workspaceRouter.post("/knowledge/sessions/:id/outputs/:kind/:outputId/schemas/:schemaId/retry", knowledgeBaseController.retryOutputSchema);
workspaceRouter.delete("/knowledge/sessions/:id/outputs/:kind/:outputId/schemas/:schemaId", knowledgeBaseController.removeOutputSchema);

// Security & Roles
workspaceRouter.get("/security/roles", securityRoleController.getRoles);
workspaceRouter.post("/security/roles", securityRoleController.saveRole);
workspaceRouter.put("/security/roles/:id", securityRoleController.saveRole);
workspaceRouter.delete("/security/roles/:id", securityRoleController.deleteRole);
workspaceRouter.get("/security/permissions", securityRoleController.getPermissions);

// Workspace System Details
workspaceRouter.get("/systems-mgmt/:workspace", workspaceController.get);
workspaceRouter.put(
    "/systems-mgmt/:workspace",
    updateWorkspaceValidator,
    validateRequest,
    workspaceController.edit,
);

export default workspaceRouter;
