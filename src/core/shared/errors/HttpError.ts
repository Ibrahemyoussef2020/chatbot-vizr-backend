import { NextFunction, Request, Response } from "express";

type HttpErrorOptions = {
    status: number;
    message: string;
};

class HttpError extends Error {
    readonly statusCode: number;
    name: string;

    constructor({ status, message }: HttpErrorOptions) {
        super(message);
        this.name = "HttpError";
        this.statusCode = status;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    get status(): number {
        return this.statusCode;
    }
}

export const createHttpError = (status: number, message: string) => new HttpError({ status, message });
export const unauthorizedError = (message = "Unauthorized") => createHttpError(401, message);
export const forbiddenError = (message = "Forbidden") => createHttpError(403, message);
export const paymentRequiredError = (message = "Payment Required") => createHttpError(402, message);
export const conflictError = (message = "Conflict") => createHttpError(409, message);
export const notFoundError = (message = "Not Found") => createHttpError(404, message);
export const unprocessableEntityError = (message = "Unprocessable Entity") => createHttpError(422, message);
export const internalServerError = (message = "Internal Server Error") => createHttpError(500, message);



export default HttpError;

