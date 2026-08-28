import { body } from "express-validator";

export const createPublicConversationValidator = [
    body("user_name")
        .if(body("name").not().exists())
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ max: 100 })
        .withMessage("Name must be 100 characters or fewer"),
    body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ max: 100 })
        .withMessage("Name must be 100 characters or fewer"),
    body("user_email")
        .optional({ values: "null" })
        .isEmail()
        .withMessage("Invalid email")
        .isLength({ max: 254 })
        .withMessage("Email must be 254 characters or fewer"),
    body("email")
        .optional({ values: "null" })
        .isEmail()
        .withMessage("Invalid email")
        .isLength({ max: 254 })
        .withMessage("Email must be 254 characters or fewer"),
    body("user_phone")
        .optional({ values: "null" })
        .trim()
        .matches(/^\+?[0-9\s().-]{7,30}$/)
        .withMessage("Invalid phone number"),
    body("phone")
        .optional({ values: "null" })
        .trim()
        .matches(/^\+?[0-9\s().-]{7,30}$/)
        .withMessage("Invalid phone number"),
];
