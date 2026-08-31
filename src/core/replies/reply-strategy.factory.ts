import { AgentReplyStrategy } from "./agent-reply.strategy.js";
import { AiReplyStrategy } from "./ai-reply.strategy.js";

const agentReplyStrategy = new AgentReplyStrategy();
const aiReplyStrategy = new AiReplyStrategy();

export class ReplyStrategyFactory {
    static create(type: "agent"): AgentReplyStrategy;
    static create(type: "ai"): AiReplyStrategy;
    static create(type: "agent" | "ai") {
        if (type === "agent") {
            return agentReplyStrategy;
        }

        return aiReplyStrategy;
    }
}
