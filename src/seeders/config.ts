export const seedConfig = {
    workspaces: [
        {
            name: "Brand Ecommerce",
            slug: "brand-ecommerce",
            rateLimit: 120,
        },
        {
            name: "Tawasal Social Media",
            slug: "tawasal-social-media",
            rateLimit: 120,
        },
        {
            name: "Ibrahem Portfolio",
            slug: "ibrahem-portfolio",
            rateLimit: 120,
        },
    ],
    workspace: {
        name: "Brand Ecommerce", 
        slug: "brand-ecommerce",
        rateLimit: 120,
    },
    users: {
        admin: {
            name: "Dashboard Admin",
            email: "admin@vizr.local",
            password: "VizrAdmin!2026",
        },
        agent: {
            name: "Demo Support Agent",
            email: "agent@vizr.local",
            password: "VizrAgent!2026",
        },
    },
} as const;
