import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyCloudinaryNotification } from "./cloudinary.js";

test("Cloudinary webhook accepts a current valid signature and rejects tampering", () => {
    const previous = {
        name: process.env.CLOUDINARY_NAME,
        key: process.env.CLOUDINARY_API_KEY,
        secret: process.env.CLOUDINARY_API_SECRET,
    };
    process.env.CLOUDINARY_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    try {
        const body = Buffer.from('{"public_id":"vizr/test"}');
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = createHash("sha1").update(body).update(timestamp).update("test-secret").digest("hex");
        assert.equal(verifyCloudinaryNotification(body, signature, timestamp), true);
        assert.equal(verifyCloudinaryNotification(Buffer.from("tampered"), signature, timestamp), false);
        assert.equal(verifyCloudinaryNotification(body, signature, "1"), false);
    } finally {
        if (previous.name === undefined) delete process.env.CLOUDINARY_NAME; else process.env.CLOUDINARY_NAME = previous.name;
        if (previous.key === undefined) delete process.env.CLOUDINARY_API_KEY; else process.env.CLOUDINARY_API_KEY = previous.key;
        if (previous.secret === undefined) delete process.env.CLOUDINARY_API_SECRET; else process.env.CLOUDINARY_API_SECRET = previous.secret;
    }
});
