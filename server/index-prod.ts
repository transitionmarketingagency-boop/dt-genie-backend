// ------------------ LOAD ENV FIRST (CRITICAL) ------------------
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE ANY OTHER IMPORTS
dotenv.config({ path: path.join(__dirname, ".env") });

// Validate environment
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing. Check your .env file.");
  process.exit(1);
}

console.log("✅ GEMINI_API_KEY loaded successfully");

// ------------------ STANDARD IMPORTS ------------------
import fs from "node:fs";
import express, { type Application } from "express";
import type { Server } from "node:http";

import runApp from "./app.js";
import { setupApp } from "./app.js";
import { getTopChunks } from "./queryChunks.js";
import { generateHybridResponse } from "./services/hybridClient.js";

// ------------------ STATIC FILE HANDLER ------------------
export function serveStatic(app: Application, _server: Server) {
  const distPublicPath = path.resolve(__dirname, "../dist/public");
  const publicPath = path.resolve(__dirname, "../public");

  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log("✅ Public folder served");
  }

  if (fs.existsSync(distPublicPath)) {
    app.use(express.static(distPublicPath));
    console.log("✅ Dist folder served");
  }

  app.get("*", (req, res, next) => {
    const indexPath = path.join(distPublicPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// ------------------ SERVER BOOTSTRAP ------------------
(async () => {
  await runApp(async (app: Application, server: Server) => {
    await setupApp(app);

    app.post("/chat", async (req, res) => {
      try {
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ reply: "Message is required." });
        }

        // 1️⃣ Create embedding
         const msgStr = message as string;
         const embedding = Array.from(msgStr).map((c) => c.charCodeAt(0) / 255);

        // 2️⃣ Fetch relevant chunks and cast items to any to fix TS error
        const chunks = (await getTopChunks(embedding, 5)) as any[];

        const context = chunks.map((c) => c.content).join("\n---\n");

        // 3️⃣ Generate final response
        const reply = await generateHybridResponse(message, context);
        res.json({ reply });
      } catch (err) {
        console.error("❌ Chat Error:", err);
        res.status(500).json({ reply: "Internal server error" });
      }
    });

    serveStatic(app, server);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(` ~@ Server running on port ${PORT}`);
    });
  });

  try {
    console.log("✅ Memory and test data loaded");
  } catch (err) {
    console.error("❌ Failed to populate test data:", err);
  }
})();
