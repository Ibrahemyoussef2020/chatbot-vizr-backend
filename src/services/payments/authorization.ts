import type { AuthenticatedUserContext } from "../workspaces/workspaces.js";
import { forbiddenError } from "../../core/shared/errors/HttpError.js";

export const authorizeBusinessPayment = (user: AuthenticatedUserContext, permission: string) => {
    if (!user.permissions?.includes(permission)) {
        throw forbiddenError(`Missing permission: ${permission}`);
    }
};
