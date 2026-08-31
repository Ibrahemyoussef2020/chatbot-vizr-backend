import { ReplyStrategyFactory } from "../core/replies/reply-strategy.factory.js";
import type {
    AgentReplyInput,
    AiReplyInput,
    ReplyInput,
    ReplyResult,
    ReplyStrategy,
} from "../core/replies/reply.types.js";

export function sendReply(input: AgentReplyInput): Promise<ReplyResult>;
export function sendReply(input: AiReplyInput): Promise<ReplyResult>;
export function sendReply(input: ReplyInput): Promise<ReplyResult> {
    const strategy = ReplyStrategyFactory.create(input.type) as ReplyStrategy<ReplyInput>;
    return strategy.reply(input);
}
