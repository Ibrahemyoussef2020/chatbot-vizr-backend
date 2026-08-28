export interface ConversationSeed {
    publicId: string;
    systemSlug?: string;
    visitor: {
        name: string;
        email: string;
        phone?: string;
    };
    priority: "high" | "medium" | "low";
    assignedAgent?: {
        id: string;
        name: string;
        email: string;
    };
    status: "active" | "ended";
    daysAgo: number;
    messages: Array<{
        senderType: "visitor" | "assistant";
        content: string;
    }>;
}

const firstNames = [
    "Sarah", "Omar", "Maya", "Youssef", "Nour", "Adam", "Lina", "Karim",
    "Fatima", "Tarek", "Hoda", "Amr", "Salma", "Khaled", "Rania", "Ziad",
    "Dalia", "Mostafa", "Yasmin", "Hassan", "Mona", "Sherif", "Layla", "Ahmed"
];

const lastNames = [
    "Ahmed", "Hassan", "Ibrahim", "Ali", "Khaled", "Samir", "Mostafa", "Adel",
    "Nasser", "Mansour", "Mahmoud", "Sherif", "Fathy", "Zaki", "Ezzat", "Hamdy",
    "Badr", "Farouk", "Salem", "Fawzy", "Tawfik", "Ghanem", "Shafik", "Nabil"
];

const agents = [
    { id: "agent-101", name: "Sarah Support Agent", email: "sarah.agent@vizr.local" },
    { id: "agent-102", name: "Karim Tech Lead", email: "karim.lead@vizr.local" },
    { id: "agent-103", name: "Amr Customer Success", email: "amr.cs@vizr.local" },
];

const ecommerceInquiries = [
    { q: "Is the leather tote available in burgundy color?", a: "Yes, it is currently in stock. Would you like the direct product checkout link?" },
    { q: "Can I update the delivery address for my recent order?", a: "I can help with that. Please share your 8-digit order number." },
    { q: "What is your 30-day return window policy?", a: "Eligible items can be returned within 30 days of delivery." },
    { q: "Do you offer complimentary gift wrapping?", a: "Yes, complimentary gift wrapping is available at checkout." },
    { q: "Where can I track my international shipment?", a: "Use the tracking link sent in your shipping confirmation email." },
    { q: "Do you have a discount code for first-time buyers?", a: "Use code WELCOME10 for 10% off your first order." },
];

const socialInquiries = [
    { q: "How do I connect WhatsApp Business API to Tawasal?", a: "Navigate to Settings > Integrations, click WhatsApp API, and scan the QR code." },
    { q: "Can the AI auto-reply to Instagram Direct Messages?", a: "Yes! Connect your Instagram Business account to enable AI auto-replies." },
    { q: "What is the monthly message limit on Scale plan?", a: "The Scale plan includes up to 50,000 automated conversations per month." },
    { q: "Can I schedule broadcast messages to subscriber lists?", a: "Yes, you can schedule broadcast campaigns under Campaign Manager." },
    { q: "Does Tawasal support multi-agent live chat handoff?", a: "Yes, when AI escalation is triggered, online human agents receive instant alerts." },
];

const portfolioInquiries = [
    { q: "Is Ibrahem available for freelance or full-time AI projects?", a: "Yes, Ibrahem is currently open to full-time roles and high-impact AI consulting." },
    { q: "Which tech stack did Ibrahem use to build this MERN AI Chatbot?", a: "Built with React 19, TypeScript, TailwindCSS, Express.js, MongoDB, and OpenAI RAG." },
    { q: "Where can I view Ibrahem's recent project portfolio?", a: "Check out the Featured Projects section on the home page or GitHub profile." },
    { q: "How can I request a project estimation or consultation?", a: "Fill out the contact form below or send an email directly to ibrahem@example.com." },
    { q: "Can I download Ibrahem's updated CV / Resume?", a: "Yes! Click the 'Download Resume' button at the top header of the portfolio." },
];

const generateSeeds = (): ConversationSeed[] => {
    const seeds: ConversationSeed[] = [];
    let counter = 1;

    const workspaceSpecs = [
        { slug: "brand-ecommerce", count: 50, inquiries: ecommerceInquiries },
        { slug: "tawasal-social-media", count: 40, inquiries: socialInquiries },
        { slug: "ibrahem-portfolio", count: 30, inquiries: portfolioInquiries },
    ];

    for (const spec of workspaceSpecs) {
        for (let i = 0; i < spec.count; i++) {
            const firstName = firstNames[i % firstNames.length];
            const lastName = lastNames[(i + Math.floor(i / firstNames.length)) % lastNames.length];
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}@example.com`;
            const phone = `+20 10${(counter * 77) % 900 + 100} ${((counter * 123) % 900) + 100}`;
            const status: "active" | "ended" = i % 3 === 0 ? "active" : "ended";
            const priority: "high" | "medium" | "low" = i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low";
            const assignedAgent = i % 2 === 0 ? agents[i % agents.length] : undefined;
            const daysAgo = i % 7;
            const inquiry = spec.inquiries[i % spec.inquiries.length];

            seeds.push({
                publicId: `seed-thread-${String(counter).padStart(3, "0")}`,
                systemSlug: spec.slug,
                visitor: {
                    name: `${firstName} ${lastName}`,
                    email,
                    phone,
                },
                priority,
                assignedAgent,
                status,
                daysAgo,
                messages: [
                    { senderType: "visitor", content: inquiry.q },
                    { senderType: "assistant", content: inquiry.a },
                ],
            });

            counter++;
        }
    }

    return seeds;
};

export const conversationSeeds: ConversationSeed[] = generateSeeds();
