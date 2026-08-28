import dns from "node:dns";
import mongoose from "mongoose";

dns.setDefaultResultOrder("ipv4first");

const publicDnsServers = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

const wait = (milliseconds: number) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
});

const isDnsError = (error: unknown) => {
    if (!(error instanceof Error)) return false;

    const networkError = error as Error & {
        code?: string;
        syscall?: string;
    };

    return networkError.syscall === "querySrv"
        || ["ECONNREFUSED", "ETIMEOUT", "ENOTFOUND", "ESERVFAIL"].includes(networkError.code || "");
};

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI environment variable is missing.");

    const maximumAttempts = Number(process.env.MONGODB_CONNECT_ATTEMPTS || 5);
    const serverSelectionTimeoutMS = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 20000);

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        try {
            await mongoose.connect(uri, { serverSelectionTimeoutMS });
            console.log("Connected to MongoDB successfully!");
            return;
        } catch (error) {
            if (attempt === maximumAttempts) throw error;

            if (attempt === 1 && isDnsError(error) && publicDnsServers.length) {
                dns.setServers(publicDnsServers);
                console.warn(`MongoDB SRV lookup failed. Retrying with DNS: ${publicDnsServers.join(", ")}`);
            }

            const retryDelay = attempt * 2000;
            console.warn(
                `MongoDB connection attempt ${attempt} failed. Retrying in ${retryDelay / 1000}s...`,
            );
            await wait(retryDelay);
        }
    }
};

export default connectDB;
