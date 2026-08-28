import { body } from "express-validator";



export const loginValidator = [
    body("email")
        .notEmpty()
        .bail()
        .withMessage('Email is required')
        .isEmail()
        .withMessage("Invalid email"),

    body("password")
        .notEmpty()
        .bail()
        .withMessage('Password is required')
]

export const registerValidator = [
    body("name")
        .notEmpty()
        .withMessage("Name is required")
        .bail()
        .isString()
        .withMessage("Name must be a string"),

    body("email")
        .notEmpty()
        .bail()
        .withMessage('Email is required')
        .isEmail()
        .withMessage("Invalid email"),

    body("password")
        .notEmpty()
        .bail()
        .withMessage('Password is required')
        .isString()
        .withMessage('Password must be a string')
        .bail()
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters long"),
]




