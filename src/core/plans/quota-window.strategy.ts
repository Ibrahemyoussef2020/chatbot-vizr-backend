import type { QuotaWindow } from "./plan.types.js";

export interface QuotaWindowStrategy {
    readonly window: QuotaWindow;
    /** Stable bucket identifier for the instant supplied. */
    key(at: Date): string;
    /** When the bucket may be reclaimed by the TTL index. */
    expiresAt(at: Date): Date;
    /** Seconds until the bucket rolls over, for Retry-After. */
    retryAfterSeconds(at: Date): number;
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** UTC everywhere: buckets must not shift when the server's local zone does. */
const parts = (at: Date) => ({
    year: at.getUTCFullYear(),
    month: at.getUTCMonth(),
    day: at.getUTCDate(),
    hours: at.getUTCHours(),
    minutes: at.getUTCMinutes(),
    seconds: at.getUTCSeconds(),
});

export const perSecondWindow: QuotaWindowStrategy = {
    window: "per_second",
    key(at) {
        const { year, month, day, hours, minutes, seconds } = parts(at);
        return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },
    expiresAt(at) {
        // Keep a short grace period so a burst arriving at the boundary still reads its own bucket.
        return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes(), at.getUTCSeconds() + 60));
    },
    retryAfterSeconds() {
        return 1;
    },
};

export const perDayWindow: QuotaWindowStrategy = {
    window: "per_day",
    key(at) {
        const { year, month, day } = parts(at);
        return `${year}-${pad(month + 1)}-${pad(day)}`;
    },
    expiresAt(at) {
        return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 2));
    },
    retryAfterSeconds(at) {
        const nextDay = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1);
        return Math.max(1, Math.ceil((nextDay - at.getTime()) / 1000));
    },
};

export const perMonthWindow: QuotaWindowStrategy = {
    window: "per_month",
    key(at) {
        const { year, month } = parts(at);
        return `${year}-${pad(month + 1)}`;
    },
    expiresAt(at) {
        return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 2, 1));
    },
    retryAfterSeconds(at) {
        const nextMonth = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1);
        return Math.max(1, Math.ceil((nextMonth - at.getTime()) / 1000));
    },
};

export const totalWindow: QuotaWindowStrategy = {
    window: "total",
    key() {
        return "total";
    },
    expiresAt(at) {
        // Lifetime ceilings never roll over; push the TTL far out rather than special-casing it.
        return new Date(Date.UTC(at.getUTCFullYear() + 100, 0, 1));
    },
    retryAfterSeconds() {
        return 0;
    },
};
