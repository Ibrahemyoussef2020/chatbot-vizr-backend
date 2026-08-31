import type { ChannelName, ChannelStrategy, OutboundChannelMessage } from "./channel.types.js";

class ChannelStrategyRegistry {
    private readonly strategies = new Map<ChannelName, ChannelStrategy>();

    register(strategy: ChannelStrategy): void {
        this.strategies.set(strategy.channel, strategy);
    }

    async send(channel: ChannelName, message: OutboundChannelMessage): Promise<void> {
        const strategy = this.strategies.get(channel);
        if (!strategy) {
            throw new Error(`No outbound strategy is registered for channel "${channel}".`);
        }
        await strategy.send(message);
    }
}

export const channelStrategyRegistry = new ChannelStrategyRegistry();
