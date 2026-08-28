import { ValidationError } from './core/shared/errors/index.js';
import { HttpError } from './core/shared/errors/index.js';

const err = new ValidationError({});
console.log("Is HttpError?", err instanceof HttpError);
console.log("err.status:", err.status);
console.log("err.message:", err.message);
