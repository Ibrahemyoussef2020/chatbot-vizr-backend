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
            
            const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;
            
            try {
                // Test password as number
                console.log("==> Test password as number");
                const res1 = await fetch(`${serverUrl}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', email: 'test3@example.com', password: 12345678 })
                });
                console.log("Status 1:", res1.status);
                
                // Test password as object
                console.log("==> Test password as object");
                const res2 = await fetch(`${serverUrl}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Test', email: 'test4@example.com', password: { length: 10 } })
                });
                console.log("Status 2:", res2.status);
                
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
