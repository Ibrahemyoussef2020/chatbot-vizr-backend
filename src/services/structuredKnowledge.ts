import { unprocessableEntityError } from "../core/shared/errors/HttpError.js";

export const validateStructuredKnowledge = (input: unknown): Record<string, unknown> => {
    let nodes = 0;
    const visit = (value: unknown, depth: number) => {
        if (++nodes > 2000 || depth > 9) throw unprocessableEntityError("Structured knowledge exceeds the nesting or field limit.");
        if (value === null || typeof value === "string" || typeof value === "boolean") return;
        if (typeof value === "number" && Number.isFinite(value)) return;
        if (Array.isArray(value)) {
            value.forEach(item => visit(item, depth + 1));
            return;
        }
        if (typeof value !== "object" || !value || Object.getPrototypeOf(value) !== Object.prototype) {
            throw unprocessableEntityError("Structured knowledge must contain JSON values only.");
        }
        for (const [key, item] of Object.entries(value)) {
            if (!key.trim() || key !== key.trim() || key.includes(".") || key.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(key)) {
                throw unprocessableEntityError("Structured knowledge contains an invalid field name.");
            }
            visit(item, depth + 1);
        }
    };
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw unprocessableEntityError("Structured knowledge must be a JSON object.");
    }
    visit(input, 0);
    if (Buffer.byteLength(JSON.stringify(input), "utf8") > 50000) throw unprocessableEntityError("Structured knowledge must be under 50 KB.");
    return input as Record<string, unknown>;
};
