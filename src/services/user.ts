import { User } from "../models/index.js";

export const getAllUsersService = async () => {
    return await User.find().select("-password");
};
