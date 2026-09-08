import AIProvider from "../models/AIProvider.js";
import { forbiddenError } from "../core/shared/errors/HttpError.js";

/** Read on every execution so saved switches also affect long-lived workers. */
export const assertAIProviderEnabled = async (code: string): Promise<void> => {
    const provider = await AIProvider.findOne({ code }).select("enabled").lean().exec();

    // An absent catalog record retains the pre-dashboard deployment defaults.
    if (provider?.enabled === false) {
        throw forbiddenError(`AI provider "${code}" is disabled in the dashboard.`);
    }
};
