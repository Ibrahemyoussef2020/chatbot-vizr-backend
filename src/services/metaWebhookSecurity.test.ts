import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { isValidMetaSignature } from "./metaWebhookSecurity.js";

test("Meta signature validation accepts authentic bytes and rejects tampering", () => {
    const raw = Buffer.from(JSON.stringify({ object: "instagram", entry: [] }));
    const secret = "test-meta-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    assert.equal(isValidMetaSignature(raw, signature, secret), true);
    assert.equal(isValidMetaSignature(Buffer.from("tampered"), signature, secret), false);
});
