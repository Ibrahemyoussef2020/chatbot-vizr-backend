export const seedConfig = {
    users: {
        businessOwner: { key: "vizr-business-owner", name: "Ibrahim Dev", email: "ibrahim.owner@vizr.local", password: "VizrOwner!2026", legacyRole: "super_admin" as const },
        workspaceOwners: [
            { key: "nile-clinic-owner", name: "Nile Clinic Owner", email: "owner@nileclinic.local", password: "NileOwner!2026", legacyRole: "admin" as const },
            { key: "atlas-store-owner", name: "Atlas Store Owner", email: "owner@atlasstore.local", password: "AtlasOwner!2026", legacyRole: "admin" as const },
            { key: "cedar-academy-owner", name: "Cedar Academy Owner", email: "owner@cedaracademy.local", password: "CedarOwner!2026", legacyRole: "admin" as const },
        ],
        agent: { name: "Demo Support Agent", email: "agent@vizr.local", password: "VizrAgent!2026" },
    },
    workspaces: [
        { name: "Brand Ecommerce", slug: "brand-ecommerce", rateLimit: 120, ownership: "business" as const },
        { name: "Vizr", slug: "vizr", rateLimit: 240, ownership: "business" as const },
        { name: "Ibrahem Portfolio", slug: "ibrahem-portfolio", rateLimit: 120, ownership: "business" as const },
        { name: "Nile Clinic", slug: "nile-clinic", rateLimit: 90, ownership: "client" as const, ownerKey: "nile-clinic-owner" },
        { name: "Atlas Store", slug: "atlas-store", rateLimit: 120, ownership: "client" as const, ownerKey: "atlas-store-owner" },
        { name: "Cedar Academy", slug: "cedar-academy", rateLimit: 90, ownership: "client" as const, ownerKey: "cedar-academy-owner" },
    ],
} as const;
