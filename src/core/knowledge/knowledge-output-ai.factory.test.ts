import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeOutputAIFactory } from "./knowledge-output-ai.factory.js";
import { generatedKnowledgeOutputSchema, type IKnowledgeOutputAI } from "./knowledge-output-ai.interface.js";

const normalizedOutput = {
    title: "Launch plan",
    description: "A grounded launch plan.",
    category: "Planning",
    schemas: [{ key: "work-plan", order: 0, title: "Work Plan", description: "Execute in phases.", notes: [], charts: [] }],
};

test("knowledge AI factory returns providers through one normalized contract", async () => {
    const provider: IKnowledgeOutputAI = { generate: async () => normalizedOutput };
    KnowledgeOutputAIFactory.registerProvider("test", provider);
    const result = await KnowledgeOutputAIFactory.getProvider("test").generate({ kind: "plan", sessionTitle: "Session", sources: [] });
    assert.deepEqual(generatedKnowledgeOutputSchema.parse(result), normalizedOutput);
});

test("knowledge output schema rejects a provider response without sections", () => {
    assert.equal(generatedKnowledgeOutputSchema.safeParse({ ...normalizedOutput, schemas: [] }).success, false);
});

test("knowledge AI factory rejects unregistered providers", () => {
    assert.throws(() => KnowledgeOutputAIFactory.getProvider("missing-provider"), /not registered/);
});
