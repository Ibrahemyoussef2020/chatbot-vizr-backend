import type { ModelMessage } from "ai";
import type { AIGatewayOptions } from "../core/ai-gateway/ai.interface.js";
import { forbiddenError, notFoundError, unprocessableEntityError } from "../core/shared/errors/HttpError.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { resolveWorkspace } from "./aiManagement.js";
import { buildAIContextPrompt, prepareAIConversation } from "./aiContext.js";
import { generateAIReply, resolveAIExecutionConfig, type AIExecutionTransport } from "./aiExecution.js";
import type { AuthenticatedUserContext } from "./workspaces.js";
import { boundChatHistory, withAiReplySlot } from "../core/replies/ai-reply.policy.js";

export const runAIGateway = async (
    user: AuthenticatedUserContext,
    input: { provider?: string; prompt?: string | ModelMessage[]; messages?: ModelMessage[]; options?: AIGatewayOptions },
    transport?: AIExecutionTransport,
) => {
    if (!user.permissions?.includes("inbox.view")) {
        throw forbiddenError("Inbox access is required for AI reply suggestions.");
    }
    const workspace = await resolveWorkspace(user, input.options?.systemSlug);
    if (input.options?.threadId) {
        const conversation = await Conversation.findOne({
            publicId: input.options.threadId,
            systemSlug: workspace.slug,
        }).lean().exec();
        if (!conversation) throw notFoundError("Conversation not found in this workspace.");
        const inbound = await Message.findOne({ conversationId: conversation._id, senderType: "visitor" })
            .sort({ createdAt: -1 }).lean().exec();
        if (!inbound) throw unprocessableEntityError("The conversation has no customer message to answer.");
        const { execution, history, systemPrompt } = await prepareAIConversation({
            type: "ai",
            systemSlug: workspace.slug,
            conversationId: String(conversation._id),
            inboundMessageId: String(inbound._id),
            channel: conversation.receivedFrom,
            providerName: input.provider,
            systemPrompt: input.options?.systemPrompt,
        });
        return withAiReplySlot(() => generateAIReply(execution, history, systemPrompt, transport));
    }
    if (workspace.defaultAiAgentId) {
        throw unprocessableEntityError("Select a conversation to use the workspace AI agent.");
    }
    const execution = await resolveAIExecutionConfig({ systemSlug: workspace.slug, channel: "web", providerName: input.provider, modelName: input.options?.model });
    const prompt = input.messages ?? input.prompt;
    const history: ModelMessage[] = typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt ?? [];
    if (!history.length) throw unprocessableEntityError("A message is required.");
    const systemPrompt = await buildAIContextPrompt(execution, workspace.slug, JSON.stringify(history), input.options?.systemPrompt);
    execution.options = {
        ...execution.options,
        ...(input.options?.model && { model: input.options.model }),
        ...(input.options?.temperature !== undefined && { temperature: input.options.temperature }),
        ...(input.options?.maxTokens !== undefined && { maxTokens: input.options.maxTokens }),
    };
    return withAiReplySlot(() => generateAIReply(execution, boundChatHistory(history), systemPrompt, transport));
};
