// ------------------ LOAD ENV FIRST (CRITICAL) ------------------
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Render injects env vars automatically (keep safe fallback)
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing. Check Render environment variables.");
  process.exit(1);
}

console.log("✅ GEMINI_API_KEY loaded");

// ------------------ IMPORTS ------------------
import express, { type Application } from "express";
import cors from "cors";
import runApp from "./app.js";
import { generateHybridResponse } from "./services/hybridClient.js";

// ------------------ SERVER BOOTSTRAP ------------------
(async () => {
  await runApp(async (app: Application, server) => {

    // Enable CORS (Framer-safe)
    app.use(
      cors({
        origin: "*",
        credentials: true,
      })
    );

    app.use(express.json());

    // ------------------ STATIC FILES ------------------
    const publicPath = path.resolve(__dirname, "../public");

    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
      console.log("✅ Public folder served:", publicPath);
    }

    // ------------------ CHAT ENDPOINT ------------------
    app.post("/chat", async (req, res) => {
      try {
        const { message } = req.body;

        if (!message || typeof message !== "string") {
          return res.status(400).json({ reply: "Message is required." });
        }

        console.log("📥 Chat request:", message);

        // ✅ SINGLE SOURCE OF TRUTH
        const reply = await generateHybridResponse(message);

        console.log("📤 Chat response sent");
        return res.json({ reply });

      } catch (err: any) {
        console.error("❌ Chat Error:", err?.message || err);
        console.error(err?.stack);
        return res.status(500).json({ reply: "Internal server error" });
      }
    });

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  });

  console.log("✅ Server bootstrap complete");
})();
