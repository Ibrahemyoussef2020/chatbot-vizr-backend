import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import app from './app.js';
import connectDB from './db/index.js';

const runTest = async () => {
    try {
        await connectDB();
        
        const server = app.listen(0, async () => {
            const port = (server.address() as any).port;
            console.log("Test server started on port", port);
            
            const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;
            
            try {
                console.log("==> Test GET /users");
                const res = await fetch(`${serverUrl}/users`);
                console.log("Status:", res.status);
                console.log("Response:", await res.text());
                
            } catch (err) {
                console.error("Fetch error:", err);
            }
            
            server.close();
            mongoose.disconnect();
        });
    } catch (err) {
        console.error("Setup error:", err);
    }
};

runTest();
