import { notFoundError } from "../core/shared/errors/HttpError.js";
import LandingPage from "../models/LandingPage.js";

const aboutComparisonSection = { type: "comparison", eyebrow: "Purpose-built business AI", heading: "Generic AI knows the web. Vizr knows your business.", description: "Public general-purpose answers are different from an operational assistant grounded in current private data.", items: [
    { label: "Generic AI", title: "Public-data guessing", description: "May invent prices, policies or product details that your business does not offer.", status: "negative" },
    { label: "Vizr", title: "Verified business knowledge", description: "Answers from uploaded documents, connected sites, FAQs and live commerce data.", status: "positive" },
    { label: "Generic AI", title: "No takeover workflow", description: "A standalone chatbot has no ownership, assignment or escalation path.", status: "negative" },
    { label: "Vizr", title: "Context-rich human handoff", description: "Alerts the right teammate and transfers conversation history, priority and customer context.", status: "positive" },
    { label: "Generic AI", title: "Disconnected channels", description: "Cannot operate a unified customer lifecycle across business messaging channels.", status: "negative" },
    { label: "Vizr", title: "Five channels, one dashboard", description: "Web, WhatsApp, Telegram, Instagram and Messenger share one inbox and identity history.", status: "positive" },
] };

const aboutTrustSection = { type: "trust", eyebrow: "Built for dependable operations", heading: "Private, observable and ready to scale", description: "Your customer experience needs more than a clever response. It needs controls your team can trust.", items: [
    { title: "Tenant isolation", description: "Every conversation, contact, channel and knowledge item remains scoped to its business." },
    { title: "Controlled access", description: "Roles, permissions and resource policies protect sensitive customer and business operations." },
    { title: "Realtime reliability", description: "Live events and durable background processing keep work moving during high-volume periods." },
    { title: "Operational visibility", description: "Usage, AI runs, queues, webhooks and audit trails make performance easier to understand." },
] };

const defaults = {
    home: {
        slug: "home", contentVersion: 6, eyebrow: "AI-powered · Your private data · 24/7 response", title: "AI customers don’t wait. Stay available 24/7.",
        description: "Connect live store data, trusted knowledge and every customer channel in one AI-assisted workspace.",
        sections: [
            { type: "heroDemo", items: [
                { label: "AI resolved", value: "84%" }, { label: "Speed", value: "<5s" }, { label: "Online", value: "24/7" },
                { sender: "customer", label: "Customer · Instagram", description: "Is the Leather Tote in Burgundy available?" },
                { sender: "assistant", label: "Vizr · <2s response", description: "Yes, Burgundy Red is in stock. It includes free gift wrapping today. Want the product link?" },
                { sender: "customer", label: "Customer · Instagram", description: "Send me the link please!" },
                { sender: "assistant", label: "Vizr · Instant", description: "Here you go: your secure product link is ready, with the INSTA10 discount applied." },
            ]},
            { type: "benefits", heading: "Everything your team needs to reply, sell and support", items: [
                { number: "01", label: "Sell more", title: "Help shoppers buy with confidence", description: "Recommend products, answer stock questions and handle order requests using live store information.", tags: ["Find products", "Check availability", "Track orders", "Handle returns"] },
                { number: "02", label: "Never miss a message", title: "Talk to customers wherever they are", description: "Bring WhatsApp, Instagram, Messenger, Telegram, email and website conversations into one inbox.", tags: ["One inbox", "Complete history", "Customer profiles", "Lead capture"] },
                { number: "03", label: "Respond faster", title: "Let AI help—and your team take over", description: "AI answers common questions and passes important conversations to the right teammate with full context.", tags: ["Instant answers", "Smart assignment", "Human takeover", "Priority alerts"] },
                { number: "04", label: "Stay accurate", title: "Answer from trusted business content", description: "Use products, policies, FAQs, documents and website content for accurate, approved answers.", tags: ["Your content", "Accurate answers", "Source references", "Private data"] },
                { number: "05", label: "Save time", title: "Automate repetitive follow-up work", description: "Organize conversations, qualify leads, update customer status and notify your team automatically.", tags: ["Qualify leads", "Organize requests", "Update status", "Notify teams"] },
                { number: "06", label: "Improve results", title: "See what customers need", description: "Track response speed, resolutions, customer growth, sales opportunities and team performance.", tags: ["Customer growth", "Response time", "Resolutions", "Sales insights"] },
            ]},
            { type: "channels", heading: "Meet customers on every channel", items: ["WhatsApp Business", "Telegram", "Instagram", "Messenger", "Email", "Web Chat"] },
            { type: "commerce", eyebrow: "Live commerce intelligence", heading: "Connect the store behind every conversation", description: "Give AI and human agents live product, customer and order context instead of generic scripts.", items: [
                { title: "Shopify", description: "Search products and variants, answer inventory questions, track orders and guide returns from current store data.", tags: ["Catalog sync", "Order tracking", "Returns", "Recommendations"] },
                { title: "WooCommerce", description: "Connect WordPress stores through secure APIs and signed webhooks for product discovery and post-purchase support.", tags: ["Products", "Coupons", "Customers", "Inventory webhooks"] },
                { title: "BigCommerce", description: "Support large multi-storefront catalogs, product options and high-volume order questions across every channel.", tags: ["Multi-storefront", "Options", "Order lookup", "Human handoff"] },
                { title: "Magento / Adobe Commerce", description: "Ground replies in complex catalogs, configurable products, customer groups and enterprise order workflows.", tags: ["Large catalogs", "Customer groups", "Queue sync", "Audited actions"] },
            ]},
            { type: "steps", eyebrow: "Get started in three steps", heading: "From business knowledge to useful answers", items: [
                { number: "01", title: "Connect your channels", description: "Add web chat, WhatsApp, Telegram and social messaging accounts from one workspace." },
                { number: "02", title: "Teach your assistant", description: "Upload documents, connect your website and synchronize product or FAQ content." },
                { number: "03", title: "Launch and improve", description: "Review conversations, take human control when needed and use analytics to improve outcomes." },
            ]},
            { type: "capabilities", eyebrow: "One connected platform", heading: "A complete conversation operating system", description: "Each capability shares identity, history and ownership instead of creating another disconnected tool.", items: [
                { label: "Conversations", title: "Secure omnichannel lifecycle", description: "Hashed visitor sessions, unified timelines, assignments, notes, tags and clear conversation states." },
                { label: "AI Workforce", title: "Specialized AI with human ownership", description: "Route intent to purpose-built agents and escalate complex work with full context and priority." },
                { label: "Knowledge & AI", title: "Grounded, observable answers", description: "Retrieve private business knowledge, route across AI providers and monitor usage, latency and failures." },
                { label: "CRM & Automation", title: "Turn signals into action", description: "Capture contacts, score leads, update lifecycle data and trigger repeatable workflows." },
                { label: "Platform", title: "Secure foundations for growth", description: "Tenant isolation, roles, realtime operations, durable jobs, audit logs and plan-based limits." },
                { label: "Developers", title: "APIs and verified webhooks", description: "Connect external systems with scoped keys, signed events, retryable delivery and diagnostics." },
            ]},
            { type: "journey", eyebrow: "Customer journey", heading: "Useful at every stage", items: [
                { label: "Discover", title: "Help shoppers find the right product", description: "Answer questions, compare options and recommend what fits using current catalog and availability data." },
                { label: "Purchase", title: "Remove objections in the moment", description: "Use customer and cart context to guide confident decisions and capture qualified opportunities." },
                { label: "Support", title: "Resolve order questions immediately", description: "Let customers track shipments, request changes and start returns without waiting in a queue." },
                { label: "Escalate", title: "Bring in a person at the right time", description: "Transfer sensitive or complex requests with history, customer data and ownership intact." },
            ]},
            { type: "analytics", eyebrow: "Conversation intelligence", heading: "Turn every conversation into a clearer growth signal", description: "See customer demand, channel volume and the work AI resolves without exporting data or building reports by hand.", items: [
                { label: "Conversations", value: "12,480", change: "+18.4%", description: "Total customer conversations" },
                { label: "New customers", value: "3,264", change: "+24.1%", description: "New customer identities captured" },
                { label: "AI resolution", value: "84%", change: "+6.2%", description: "Resolved without human takeover" },
                { label: "Average response", value: "8 sec", change: "-31%", description: "Time to first useful reply" },
                { label: "WhatsApp", value: "46%", description: "5,741 conversations · strongest channel" },
                { label: "Web chat", value: "29%", description: "3,619 conversations · 22% converted" },
                { label: "Instagram", value: "17%", description: "2,122 conversations · fastest growth" },
                { label: "Other", value: "8%", description: "998 conversations across other channels" },
            ]},
            { type: "roi", eyebrow: "Business impact & ROI", heading: "Calculate your support savings", description: "Estimate the time and annual labor value recovered when routine questions receive immediate answers.", items: [
                { label: "Default monthly queries", value: 5000 }, { label: "Default hourly rate", value: 25 }, { label: "Automation rate", value: 84 }, { label: "Minutes per query", value: 3.5 },
            ]},
            { type: "workflow", eyebrow: "Architectural workflow", heading: "Five channels. One dashboard. Zero chaos.", description: "Messages move through private business knowledge and return as an instant answer or a context-rich human handoff.", items: [
                { number: "01", label: "Inbound", title: "Connected customer channels", description: "WhatsApp, Telegram, Instagram, Messenger and Web Chat enter one secure conversation pipeline." },
                { number: "02", label: "Understand", title: "Private AI core and RAG", description: "Retrieve relevant context from approved PDFs, FAQs, website content, product data and recent conversation history." },
                { number: "03", label: "Decide", title: "Answer or escalate", description: "Resolve routine questions immediately or alert the correct supervisor with priority and full context." },
                { number: "04", label: "Learn", title: "Save outcomes to analytics", description: "Record resolution, response time, lead outcome and channel performance for continuous improvement." },
            ]},
            { type: "industries", eyebrow: "Industry playbooks", heading: "Works for any business that talks to customers", description: "Explore realistic questions and grounded answers for common customer-facing industries.", items: [
                { code: "ecommerce", title: "E-Commerce & Retail", label: "Popular", description: "Order status, returns and size guides answered instantly, even while the store is closed.", question: "Where is order #48210, and can I change the delivery address?", answer: "Order #48210 is out for delivery today. Address changes remain available until 4 PM through the secure order link.", tags: ["Order tracking", "Returns", "Stock inquiries"] },
                { code: "education", title: "Education & Academics", label: "High recall", description: "Course requirements, tuition deadlines and schedules delivered to prospective students.", question: "What is the application deadline for the Data Science master’s degree?", answer: "Fall applications close September 15. Required documents include a bachelor’s transcript and an eligible language score.", tags: ["Admissions FAQ", "Tuition", "Course catalog"] },
                { code: "realestate", title: "Real Estate & Hospitality", label: "24/7 leads", description: "Availability, rental prices and tour links delivered automatically to high-intent enquiries.", question: "Is the two-bedroom seafront apartment available next weekend?", answer: "The Seafront Suite is available next weekend for $140 per night, including Wi-Fi and parking.", tags: ["Availability", "Floor plans", "Pricing"] },
                { code: "healthcare", title: "Clinics & Wellness", label: "Private RAG", description: "Appointment availability, practitioner hours and clinic locations served with strict privacy.", question: "Can I book a dental consultation this Thursday?", answer: "Available Thursday appointments are 11:30 AM and 4:00 PM at the Central Clinic.", tags: ["Appointments", "Clinic hours", "Coverage"] },
            ]},
            { type: "ecosystem", eyebrow: "Platform", heading: "A connected support ecosystem", description: "Customer data moves from every entry point through an intelligent core to your team and secure infrastructure.", items: [
                { label: "Entry points", title: "Omnichannel intake", description: "WhatsApp Business, Telegram bots, Web Chat, Instagram DMs and Messenger pages." },
                { label: "AI core", title: "Business-trained intelligence", description: "Answers use your private knowledge base, product catalog and approved operating rules." },
                { label: "Internal process", title: "Human handoff and control center", description: "Smart priority, automatic tagging and seamless escalation preserve ownership." },
                { label: "Reliability", title: "Secure private operations", description: "Tenant isolation, signed webhooks, role-based access, SLAs and complete audit trails." },
            ]},
            aboutComparisonSection,
        ],
    },
    about: {
        slug: "about", contentVersion: 6, eyebrow: "About Vizr", title: "AI conversations built around real business context.",
        description: "We help commerce and service teams respond faster without losing accuracy, ownership or the human relationship.",
        sections: [{ type: "values", heading: "How we build", items: [
            { title: "Customer outcomes first", description: "Every workflow should reduce waiting, remove friction and create measurable value." },
            { title: "Trust by design", description: "Private tenant data, controlled access and auditable operations are foundational." },
            { title: "Human when it matters", description: "Automation handles repetition while people retain control of sensitive and complex work." },
            { title: "Long-term partnership", description: "We continuously improve platform reliability and practical business capability." },
        ]}, {
            type: "story",
            eyebrow: "Why we exist",
            heading: "Customer conversations should feel connected, useful and human.",
            description: "Vizr was created around a simple belief: businesses should not have to choose between fast automation and thoughtful customer care.",
            items: [
                { label: "Our mission", title: "Make every customer feel heard", description: "Help teams respond at the moment customers need them, with answers grounded in real business knowledge rather than generic guesses." },
                { label: "Our approach", title: "Connect context before automating", description: "Bring conversations, knowledge and ownership together first, then use AI to remove repetitive work without losing accountability." },
                { label: "Our standard", title: "Build trust into every interaction", description: "Design privacy, visibility and human control into the product so teams can understand and confidently manage what automation does." },
                { label: "Our direction", title: "Grow alongside the businesses we serve", description: "Create durable tools that become more valuable as customer needs, channels and teams evolve over time." },
            ],
        }, aboutTrustSection],
    },
    pricing: {
        slug: "pricing", contentVersion: 3, eyebrow: "Simple, transparent pricing", title: "Plans that scale with your growth.", description: "Start small, add channels and teammates, and move up as conversation volume grows.",
        sections: [{ type: "plans", items: [
            { code: "starter", eyebrow: "Ideal for small teams", name: "Starter", description: "Essential AI chat automation and omnichannel messaging for small businesses launching customer support.", monthlyPrice: 29, yearlyPrice: 290, currency: "USD", popular: false, ctaLabel: "Start Free Trial", features: ["Up to 1,000 AI conversations / mo", "2 connected messaging channels", "Basic e-commerce catalog connector", "Standard response speed (< 5s)", "Single user inbox workspace", "Email support"] },
            { code: "growth", eyebrow: "Most popular", name: "Growth", description: "Advanced AI agents, deep store connectors, and human escalation tools for fast-growing storefronts.", monthlyPrice: 79, yearlyPrice: 790, currency: "USD", popular: true, ctaLabel: "Get Started Now", features: ["Up to 5,000 AI conversations / mo", "All 5 connected messaging channels", "Full Shopify & WooCommerce sync", "Smart human takeover & routing", "5 agent team inbox seats", "Lead capture & AI lead scoring", "Priority email & chat support"] },
            { code: "enterprise", eyebrow: "For large operations", name: "Enterprise", description: "Custom AI workflows, high conversation volume, SLA monitoring, and dedicated account management.", monthlyPrice: 199, yearlyPrice: 1990, currency: "USD", popular: false, ctaLabel: "Contact Enterprise Sales", ctaPath: "/contact", features: ["Unlimited AI conversations", "All channels + Custom REST APIs", "Enterprise Adobe & Magento connectors", "Custom AI persona & model policies", "Unlimited team seats & role controls", "SLA management & audit logs", "24/7 dedicated account manager"] },
        ]}],
    },
};

export const getLandingPage = async (slug: string) => {
    const initial = defaults[slug as keyof typeof defaults];
    if (!initial) throw notFoundError("Landing page not found");
    let page = await LandingPage.findOne({ slug }).lean();
    if (!page || (page.contentVersion || 0) < initial.contentVersion) {
        page = await LandingPage.findOneAndUpdate({ slug }, { $set: initial }, { new: true, upsert: true, lean: true });
    }
    return { page };
};
