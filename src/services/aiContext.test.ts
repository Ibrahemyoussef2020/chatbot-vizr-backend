import assert from "node:assert/strict";
import test from "node:test";
import { serializeStructuredKnowledge } from "./aiContext.js";

test("structured chatbot knowledge is serialized into a bounded prompt section", () => {
    assert.match(serializeStructuredKnowledge({ products: [{ name: "Vizr Pro" }] }), /Vizr Pro/);
    assert.equal(serializeStructuredKnowledge({}), "");
    assert.equal(serializeStructuredKnowledge({ value: "long content" }, 8).length, 8);
});
