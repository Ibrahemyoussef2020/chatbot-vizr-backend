import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const schema = new mongoose.Schema({
    whatsapp_phone_number_id: String,
    whatsapp_access_token: String,
    system_slug: String
}, { strict: false });

const WhatsAppConfig = mongoose.model("WhatsAppConfig", schema, "whatsappconfigs");
const Workspace = mongoose.model("Workspace", new mongoose.Schema({}, { strict: false }), "workspaces");

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "");
        console.log("Connected to MongoDB.");
        const configs = await WhatsAppConfig.find().lean();
        console.log("WhatsAppConfigs in DB:");
        configs.forEach((c: any) => {
            console.log(`- Workspace ID: ${c.workspaceId}`);
            console.log(`  Token: ${c.whatsapp_access_token?.substring(0, 20)}...`);
            console.log(`  Phone ID: ${c.whatsapp_phone_number_id}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
check();
