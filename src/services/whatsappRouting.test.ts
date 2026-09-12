import assert from "node:assert/strict";
import test from "node:test";
import { WhatsAppConfig } from "../models/index.js";
import { resolveWhatsAppPhoneConfig } from "./whatsappRouting.js";

test("shared WhatsApp routing selects one stable account handler", async context => {
    context.mock.method(WhatsAppConfig, "find", (filter: any) => {
        assert.deepEqual(filter, { whatsapp_phone_number_id: "phone" });
        return { sort: (sort: unknown) => {
            assert.deepEqual(sort, { createdAt: 1, _id: 1 });
            return { limit: (limit: number) => {
                assert.equal(limit, 1);
                return { exec: async () => [{ workspaceId: "one" }] };
            } };
        } };
    });
    assert.equal((await resolveWhatsAppPhoneConfig(" phone "))?.workspaceId, "one");
});

test("WhatsApp routing resolves exactly one configured workspace", async context => {
    const config = { workspaceId: "brand" };
    context.mock.method(WhatsAppConfig, "find", () => ({ sort: () => ({ limit: () => ({ exec: async () => [config] }) }) }));
    assert.equal(await resolveWhatsAppPhoneConfig("phone"), config);
    assert.equal(await resolveWhatsAppPhoneConfig(undefined), null);
});
