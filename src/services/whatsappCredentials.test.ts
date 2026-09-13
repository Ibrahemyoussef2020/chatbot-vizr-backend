import assert from "node:assert/strict";
import test from "node:test";
import { WhatsAppConfig } from "../models/index.js";
import { syncWhatsAppAccessToken } from "./whatsappCredentials.js";

test("token renewal only updates Meta configs linked to the same physical phone", async context => {
    let updates = 0;
    context.mock.method(WhatsAppConfig, "updateMany", (filter: unknown, update: unknown) => {
        assert.deepEqual(filter, { whatsapp_phone_number_id: "shared-phone", provider: "meta" });
        assert.deepEqual(update, { $set: { whatsapp_access_token: "new-token" } });
        return { exec: async () => { updates += 1; } };
    });
    await syncWhatsAppAccessToken(" shared-phone ", " new-token ");
    await syncWhatsAppAccessToken("", "new-token");
    await syncWhatsAppAccessToken("shared-phone", " ");
    await syncWhatsAppAccessToken(undefined, undefined);
    assert.equal(updates, 1);
});
