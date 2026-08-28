import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../core/shared/errors/index.js";


const validateRequest = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const result = validationResult(req);


    if (!result.isEmpty()) {
        const errors = result.array().reduce<Record<string, string[]>>(
            (acc, cur) => {
                if ("path" in cur && "msg" in cur) {
                    acc[cur.path] ??= [];
                    acc[cur.path].push(cur.msg);
                }

                return acc;
            },
            {}
        );

        return next(new ValidationError(errors));

    }

    next();
};

export default validateRequest;