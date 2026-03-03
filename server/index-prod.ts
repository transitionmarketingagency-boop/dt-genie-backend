// server/index-prod.ts
import 'dotenv/config';
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";

import runApp, { setupApp } from "./app.js";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { memoryService, initializeMemory } from "./services/memoryService.js";
import { initializeAIIntents } from "./services/json_loader.js"; // ✅ new import

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

// ---------------- VECTOR STORE INIT ----------------
const dbDir = path.resolve(process.cwd(), "server/vector_store");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Vector DB folder created:", dbDir);
} else {
  console.log("✅ Vector DB folder exists:", dbDir);
}

// ---------------- MEMORY DB INIT ----------------
await initializeMemory();
console.log("✅ Memory DB initialized");

// ---------------- AI INTENTS INIT ----------------
initializeAIIntents(); // ✅ ensures aiIntents is loaded before any requests

// ---------------- START SERVER ----------------
(async () => {
  try {
    await runApp(async (app: Application, httpServer: Server) => {

      app.use(cors({ origin: "*", credentials: true }));
      app.use(express.json({ limit: "10mb" }));
      app.use(express.urlencoded({ limit: "10mb", extended: true }));

      // Serve static public folder
      const publicPath = path.resolve(process.cwd(), "public");
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
      }

      // ---------------- CHAT ROUTE ----------------
      app.post("/chat", async (req: Request, res: Response) => {
        try {
          let { message, sessionId } = req.body as { message?: string; sessionId?: string };

          if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "Message is required" });
          }
          if (!sessionId || typeof sessionId !== "string") {
            sessionId = "default-session";
          }

          // Save user message
          await memoryService.addMessage(sessionId, "user", message);

          // Generate hybrid response ✅ updated to single object argument
          let reply: string;
          try {
            reply = await generateHybridResponse({
              message,
              sessionId,
            });
          } catch (err) {
            console.warn("⚠️ Hybrid response failed:", err);
            reply = "";
          }

          // Fallback if empty
          if (!reply || reply.trim().length === 0) {
            reply = "Sure — you can book a call with our team here: [Your Calendly Link]";
          }

          // Save assistant message
          await memoryService.addMessage(sessionId, "assistant", reply);

          // Return chat reply only
          res.json({ reply });

        } catch (err) {
          console.error("❌ Chat route error:", err);
          res.status(500).json({ error: "Internal server error" });
        }
      });

      console.log("✅ Hybrid chat route initialized");

      // Optional: keep other routes if needed
      await setupApp(app);

      const PORT = Number(process.env.PORT) || 5000;
      httpServer.listen(PORT, () =>
        console.log(` ~@ Server running on port ${PORT}`)
      );
    });

   console.log("✅ Server bootstrap complete");

  } catch (err) {
    console.error("❌ Server bootstrap failed:", err);
    process.exit(1);
  }
})();
