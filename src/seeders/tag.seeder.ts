import Tag from "../models/Tag.js";

export const seedTags = async () => {
    const slugs = ["brand-ecommerce", "tawasal-social-media", "ibrahem-portfolio"];

    const rawLabels = [
        { id: "vip-lead", label: "VIP Lead", bg: "#dbeafe", color: "#1d4ed8", description: "High value tier account", usageCount: 42 },
        { id: "urgent-escalation", label: "Urgent Escalation", bg: "#fee2e2", color: "#dc2626", description: "Immediate manager review", usageCount: 18 },
        { id: "payment-pending", label: "Payment Pending", bg: "#fef3c7", color: "#d97706", description: "Awaiting invoice settlement", usageCount: 27 },
        { id: "refund-approved", label: "Refund Approved", bg: "#dcfce7", color: "#15803d", description: "Refund processed by finance", usageCount: 14 },
        { id: "feature-request", label: "Feature Request", bg: "#f3e8ff", color: "#7e22ce", description: "Product enhancement feedback", usageCount: 35 },
        { id: "technical-bug", label: "Technical Bug", bg: "#ffe4e6", color: "#e11d48", description: "Software defect reported", usageCount: 22 },
        { id: "shipping-delay", label: "Shipping Delay", bg: "#ffedd5", color: "#c2410c", description: "Courier tracking delay", usageCount: 19 },
        { id: "enterprise-plan", label: "Enterprise Plan", bg: "#cff4fc", color: "#055160", description: "Custom SLA & contract", usageCount: 11 },
        { id: "sales-prospect", label: "Sales Prospect", bg: "#e0e7ff", color: "#4338ca", description: "Qualified inbound sales lead", usageCount: 56 },
        { id: "account-onboarding", label: "Account Onboarding", bg: "#f0fdf4", color: "#166534", description: "New customer setup guide", usageCount: 31 },
        { id: "order-cancelled", label: "Order Cancelled", bg: "#f1f5f9", color: "#475569", description: "Customer requested cancellation", usageCount: 9 },
        { id: "csat-5-star", label: "CSAT 5 Star", bg: "#fef08a", color: "#a16207", description: "Highest satisfaction rating", usageCount: 68 },
        { id: "partner-integration", label: "Partner Integration", bg: "#fae8ff", color: "#a21caf", description: "Third party webhook setup", usageCount: 16 },
        { id: "security-verification", label: "Security Verification", bg: "#e2e8f0", color: "#334155", description: "Identity authentication check", usageCount: 8 },
        { id: "subscription-upgrade", label: "Subscription Upgrade", bg: "#d1fae5", color: "#047857", description: "Plan expansion inquiry", usageCount: 24 },
        { id: "discount-inquiry", label: "Discount Inquiry", bg: "#fef9c3", color: "#854d0e", description: "Coupon or promo code help", usageCount: 39 },
        { id: "api-rate-limit", label: "API Rate Limit", bg: "#fed7aa", color: "#9a3412", description: "Developer quota exceeded", usageCount: 7 },
        { id: "human-handoff", label: "Human Agent Handoff", bg: "#e0f2fe", color: "#0369a1", description: "Transferred from AI bot", usageCount: 48 },
        { id: "feedback-neutral", label: "Feedback Neutral", bg: "#f3f4f6", color: "#374151", description: "General user comments", usageCount: 15 },
        { id: "resolved-ticket", label: "Resolved Ticket", bg: "#bbf7d0", color: "#166534", description: "Successfully closed inquiry", usageCount: 84 },
    ];

    let count = 0;
    for (const slug of slugs) {
        for (const item of rawLabels) {
            const publicId = `seed-tag-${item.id}-${slug}`;
            await Tag.findOneAndUpdate(
                { publicId },
                {
                    $set: {
                        systemSlug: slug,
                        label: item.label,
                        name: item.label,
                        bg: item.bg,
                        color: item.color,
                        description: item.description,
                        usageCount: item.usageCount,
                    },
                    $setOnInsert: {
                        publicId,
                    },
                },
                { upsert: true },
            ).exec();
            count++;
        }
    }

    return { tags: count };
};
