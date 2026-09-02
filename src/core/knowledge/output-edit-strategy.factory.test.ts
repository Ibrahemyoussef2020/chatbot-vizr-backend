import assert from "node:assert/strict";
import test from "node:test";
import { OutputEditStrategyFactory } from "./output-edit-strategy.factory.js";

test("manual output edit validates and returns one complete schema", async () => {
    const current = { title: "Old", description: "Old description", notes: [], charts: [] };
    const next = { title: "Requirements", description: "Updated requirements", notes: [{ title: "Authentication", description: "Required" }], charts: [] };
    assert.deepEqual(await OutputEditStrategyFactory.create("manual").edit(current, next), next);
});

test("output edit factory rejects unsupported edit modes", () => {
    assert.throws(() => OutputEditStrategyFactory.create("automatic"), /manual or ai/);
});
