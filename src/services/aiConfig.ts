import { Workspace, AIConfig } from "../models/index.js";

const resolveWorkspace = async (slug?: string) => {
    if (!slug) {
        return await Workspace.findOne().sort({ createdAt: 1 }).exec();
    }
    return await Workspace.findOne({ slug: slug.toLowerCase() }).exec();
};

export const getAIConfigService = async (systemSlug?: string) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) return null;

    let config = await AIConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) {
        config = await AIConfig.create({
            workspaceId: ws._id,
            company_name: ws.name,
            assistant_name: `${ws.name} Bot`,
            contact_email: "support@company.com",
            website_url: `https://${ws.slug}.com`,
            contact_us_link: `https://${ws.slug}.com/contact`,
            company_description: `Official AI assistant for ${ws.name}.`,
            tone_instructions: "Be helpful, professional, friendly, and accurate.",
            pricing_instructions: "Standard tier included. Contact support for Enterprise billing.",
            language_notes: "Supports English, Arabic, and French.",
            contact_collection_rules: "Ask for name, email, and primary inquiry topic.",
            actions_data: [
                { action: "Visit Store", link: `https://${ws.slug}.com/store`, description: "Explore latest product offerings" },
                { action: "Book Consultation", link: `https://${ws.slug}.com/book`, description: "Schedule a live video call" },
            ],
            uploaded_files: [
                { name: "Product_Catalog_2026.pdf", url: "https://cdn.example.com/docs/catalog.pdf", size: 245000 },
                { name: "Support_FAQ_Guide.pdf", url: "https://cdn.example.com/docs/faq.pdf", size: 180000 },
            ],
        });
    }

    return {
        id: config._id.toString(),
        system_id: ws.slug,
        tenant_name: ws.name,
        company_name: config.company_name,
        assistant_name: config.assistant_name,
        contact_email: config.contact_email,
        website_url: config.website_url,
        contact_us_link: config.contact_us_link,
        company_description: config.company_description,
        tone_instructions: config.tone_instructions,
        pricing_instructions: config.pricing_instructions,
        language_notes: config.language_notes,
        contact_collection_rules: config.contact_collection_rules,
        actions_data: config.actions_data || [],
        uploaded_files: config.uploaded_files || [],
    };
};

export const saveAIConfigService = async (systemSlug?: string, payload?: any) => {
    const ws = await resolveWorkspace(systemSlug);
    if (!ws) throw new Error("Workspace not found.");

    let config = await AIConfig.findOne({ workspaceId: ws._id }).exec();
    if (!config) {
        config = new AIConfig({ workspaceId: ws._id });
    }

    if (payload?.company_name !== undefined) config.company_name = payload.company_name;
    if (payload?.assistant_name !== undefined) config.assistant_name = payload.assistant_name;
    if (payload?.contact_email !== undefined) config.contact_email = payload.contact_email;
    if (payload?.website_url !== undefined) config.website_url = payload.website_url;
    if (payload?.contact_us_link !== undefined) config.contact_us_link = payload.contact_us_link;
    if (payload?.company_description !== undefined) config.company_description = payload.company_description;
    if (payload?.tone_instructions !== undefined) config.tone_instructions = payload.tone_instructions;
    if (payload?.pricing_instructions !== undefined) config.pricing_instructions = payload.pricing_instructions;
    if (payload?.language_notes !== undefined) config.language_notes = payload.language_notes;
    if (payload?.contact_collection_rules !== undefined) config.contact_collection_rules = payload.contact_collection_rules;
    if (payload?.actions_data !== undefined) config.actions_data = payload.actions_data;
    if (payload?.uploaded_files !== undefined) config.uploaded_files = payload.uploaded_files;

    await config.save();

    return getAIConfigService(ws.slug);
};

export const deleteAIConfigService = async (configId: string) => {
    await AIConfig.findByIdAndDelete(configId).exec();
    return true;
};
