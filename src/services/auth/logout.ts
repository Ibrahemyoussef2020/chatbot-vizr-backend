const logoutService = async (_token?: string): Promise<{ message: string }> => {
    return { message: "logout successful" };
};

export default logoutService;
