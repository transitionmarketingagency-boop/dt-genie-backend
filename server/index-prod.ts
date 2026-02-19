import 'dotenv/config';
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application } from "express";
import { createServer, type Server } from "node:http";

import runApp, { setupApp } from "./app.js";
import { generateHybridResponse } from "./services/hybridClient.js";
import { storage } from "./storage.js";

// ---------------- ENV CHECK ----------------
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing.");
  process.exit(1);
}
console.log("✅ GEMINI_API_KEY loaded");

// ---------------- GOOGLE SERVICE ACCOUNT ----------------
if (process.env.SERVICE_ACCOUNT_BASE64) {
  try {
    const json = Buffer.from(process.env.SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    const keyPath = path.join(process.cwd(), "server/sa-key.json");
    fs.writeFileSync(keyPath, json);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    console.log("✅ Google service account key created:", keyPath);
  } catch (err) {
    console.error("❌ Failed to create Google service account key:", err);
    process.exit(1);
  }
}

// ---------------- DB INIT ----------------
const dbDir = path.resolve(process.cwd(), "server/vector_store");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Vector DB folder created:", dbDir);
} else {
  console.log("✅ Vector DB folder exists:", dbDir);
}

// ---------------- START SERVER ----------------
(async () => {
  try {
    await runApp(async (app: Application, httpServer: Server) => {
      // Middleware
      app.use(cors({ origin: "*", credentials: true }));
      app.use(express.json({ limit: "10mb" }));
      app.use(express.urlencoded({ limit: "10mb", extended: true }));

      // Serve public folder if exists
      const publicPath = path.resolve(process.cwd(), "public");
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        console.log("✅ Public folder served:", publicPath);
      }

      // Setup app routes
      await setupApp(app);

      // Start HTTP server
      const PORT = process.env.PORT || 5000;
      httpServer.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
    });

    console.log("✅ Server bootstrap complete");
  } catch (err) {
    console.error("❌ Server bootstrap failed:", err);
    process.exit(1);
  }
})();
