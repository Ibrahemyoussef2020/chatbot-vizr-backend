import { AgentReplyStrategy } from "./agent-reply.strategy.js";
import { AiReplyStrategy } from "./ai-reply.strategy.js";
import type { ReplyType } from "./reply.types.js";

interface ReplyStrategyRegistry {
    agent: AgentReplyStrategy;
    ai: AiReplyStrategy;
}

export class ReplyStrategyFactory {
    private static readonly strategies = new Map<ReplyType, ReplyStrategyRegistry[ReplyType]>();

    static register<TType extends ReplyType>(type: TType, strategy: ReplyStrategyRegistry[TType]): void {
        this.strategies.set(type, strategy);
    }

    static create<TType extends ReplyType>(type: TType): ReplyStrategyRegistry[TType] {
        const strategy = this.strategies.get(type);
        if (!strategy) throw new Error(`Reply strategy "${type}" is not registered.`);
        return strategy as ReplyStrategyRegistry[TType];
    }
}

ReplyStrategyFactory.register("agent", new AgentReplyStrategy());
ReplyStrategyFactory.register("ai", new AiReplyStrategy());
