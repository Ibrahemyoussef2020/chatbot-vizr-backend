import assert from "node:assert/strict";
import test from "node:test";
import {
    duplicateDisposition,
    isTransientUploadStatus,
    retryDelayMs,
    runWithUploadRetry,
    validateUploadDescriptor,
} from "./upload-policy.js";

test("successful large upload processes every chunk without buffering the whole file", async () => {
    const total = 120 * 1024 * 1024;
    const chunk = 8 * 1024 * 1024;
    let uploaded = 0;
    while (uploaded < total) uploaded += await runWithUploadRetry(async () => Math.min(chunk, total - uploaded));
    assert.equal(uploaded, total);
});

test("transient chunk failures retry and eventually succeed", async () => {
    let calls = 0;
    const result = await runWithUploadRetry(async () => {
        calls += 1;
        if (calls < 3) throw Object.assign(new Error("temporary"), { status: 503 });
        return "uploaded";
    }, { shouldRetry: (error) => isTransientUploadStatus(Number((error as { status: number }).status)), pause: async () => undefined });
    assert.equal(result, "uploaded");
    assert.equal(calls, 3);
});

test("permanent Cloudinary failures are not retried", async () => {
    let calls = 0;
    await assert.rejects(runWithUploadRetry(async () => {
        calls += 1;
        throw Object.assign(new Error("invalid signature"), { status: 401 });
    }, { shouldRetry: (error) => isTransientUploadStatus(Number((error as { status: number }).status)), pause: async () => undefined }), /invalid signature/);
    assert.equal(calls, 1);
});

test("cancellation stops work before another upload attempt", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(runWithUploadRetry(async () => { calls += 1; }, { signal: controller.signal }), { name: "AbortError" });
    assert.equal(calls, 0);
});

test("invalid and oversized files are rejected", () => {
    assert.throws(() => validateUploadDescriptor("", 10, 100), /Invalid file metadata/);
    assert.throws(() => validateUploadDescriptor("video.mp4", 101, 100), /File exceeds/);
});

test("duplicates resume active uploads and reuse completed assets", () => {
    assert.equal(duplicateDisposition("INITIATED"), "resume");
    assert.equal(duplicateDisposition("UPLOADING"), "resume");
    assert.equal(duplicateDisposition("COMPLETED"), "duplicate");
    assert.equal(duplicateDisposition("FAILED"), "replace");
});

test("database and permanent Cloudinary failures remain categorized as permanent", () => {
    assert.equal(isTransientUploadStatus(400), false);
    assert.equal(isTransientUploadStatus(401), false);
    assert.equal(isTransientUploadStatus(503), true);
    assert.equal(isTransientUploadStatus(429), true);
});

test("exponential backoff is bounded", () => {
    assert.equal(retryDelayMs(0, 0), 500);
    assert.equal(retryDelayMs(10, 1), 10_000);
});
