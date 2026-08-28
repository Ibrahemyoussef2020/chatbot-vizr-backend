import "dotenv/config";
import app from "./app.js";
import connectDB from "./db/index.js";

connectDB()
    .then(() => {
        const port = process.env.PORT || 5000;
        const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;
        app.listen(port, () => {
            console.log(`Server is running at ${serverUrl}`);
        });
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
        process.exit(1);
    });

