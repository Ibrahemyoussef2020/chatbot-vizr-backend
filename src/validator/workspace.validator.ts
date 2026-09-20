import { body } from "express-validator";

const workspaceProfileValidators = [
    body("business_name").optional({ values: "falsy" }).trim().isLength({ max: 255 }).withMessage("Business name must be 255 characters or fewer"),
    body("industry").optional({ values: "falsy" }).trim().isLength({ max: 120 }).withMessage("Industry must be 120 characters or fewer"),
    body("website_url").optional({ values: "falsy" }).trim().isURL({ require_protocol: true }).withMessage("Website must be a valid URL including https://"),
    body("support_email").optional({ values: "falsy" }).trim().isEmail().withMessage("Support email must be valid"),
    body("support_phone").optional({ values: "falsy" }).trim().isLength({ max: 40 }).withMessage("Support phone must be 40 characters or fewer"),
    body("country").optional({ values: "falsy" }).trim().isLength({ max: 120 }).withMessage("Country must be 120 characters or fewer"),
    body("timezone").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("Timezone must be 100 characters or fewer"),
    body("currency").optional({ values: "falsy" }).trim().matches(/^[A-Z]{3}$/i).withMessage("Currency must be a 3-letter code"),
];

export const createWorkspaceValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Workspace name is required")
        .isLength({ max: 255 })
        .withMessage("Workspace name must be 255 characters or fewer"),
    body("rate_limit")
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage("Rate limit must be between 1 and 1000"),
    ...workspaceProfileValidators,
];

export const updateWorkspaceValidator = [
    body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Workspace name cannot be empty")
        .isLength({ max: 255 })
        .withMessage("Workspace name must be 255 characters or fewer"),
    body("is_active")
        .optional()
        .isBoolean()
        .withMessage("Active status must be a boolean"),
    body("rate_limit")
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage("Rate limit must be between 1 and 1000"),
    ...workspaceProfileValidators,
];
