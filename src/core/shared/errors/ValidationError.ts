import HttpError from "./HttpError.js";

class ValidationError extends HttpError {
    constructor(errors: Record<string, string[]>) {
        super({
            status: 422,
            message: "Validation failed",
        });

        this.name = "ValidationError";
        this.errors = errors;
    }

    public readonly errors: Record<string, string[]>;
}

export default ValidationError;