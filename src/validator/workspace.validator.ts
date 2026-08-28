import { body } from "express-validator";

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
];
