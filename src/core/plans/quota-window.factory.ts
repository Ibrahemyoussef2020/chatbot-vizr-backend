import type { QuotaWindow } from "./plan.types.js";
import {
    perDayWindow,
    perMonthWindow,
    perSecondWindow,
    totalWindow,
    type QuotaWindowStrategy,
} from "./quota-window.strategy.js";

export class QuotaWindowFactory {
    private static readonly strategies = new Map<QuotaWindow, QuotaWindowStrategy>();

    static register(strategy: QuotaWindowStrategy): void {
        this.strategies.set(strategy.window, strategy);
    }

    static create(window: QuotaWindow): QuotaWindowStrategy {
        const strategy = this.strategies.get(window);
        if (!strategy) throw new Error(`Quota window strategy "${window}" is not registered.`);
        return strategy;
    }

    static listWindows(): QuotaWindow[] {
        return [...this.strategies.keys()];
    }
}

QuotaWindowFactory.register(perSecondWindow);
QuotaWindowFactory.register(perDayWindow);
QuotaWindowFactory.register(perMonthWindow);
QuotaWindowFactory.register(totalWindow);
