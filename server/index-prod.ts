import "dotenv/config";
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application } from "express";
import { type Server } from "node:http";

import runApp, { setupApp } from "./app.js";
import { generateHybridResponse } from "./services/hybridClient.js";
import { fetchRelevantChunks } from "./queryChunksWrapper.js";
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
    const json = Buffer.from(
      process.env.SERVICE_ACCOUNT_BASE64,
      "base64"
    ).toString("utf8");

    const keyPath = path.join(process.cwd(), "server/sa-key.json");
    fs.writeFileSync(keyPath, json);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

    console.log("✅ Google service account key created:", keyPath);
  } catch (err) {
    console.error("❌ Failed to create Google service account key:", err);
    process.exit(1);
  }
}

// ---------------- VECTOR DB INIT ----------------
const dbDir = path.resolve(process.cwd(), "server/vector_store");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✅ Vector DB folder created:", dbDir);
} else {
  console.log("✅ Vector DB folder exists:", dbDir);
}

// ---------------- STATIC INTENT LOGIC ----------------

function detectStaticIntent(question: string): string | null {
  const q = question.toLowerCase().trim();

  // Identity
  if (q.includes("who are you") || q.includes("describe your persona")) {
    return "I am Neon Vision — the AI operating system behind Digital Transition Marketing. I design strategy, automate execution, analyze performance, and architect scalable digital growth systems.";
  }

  // Mission
  if (q.includes("mission")) {
    return "Our mission is to transition businesses into the digital future using AI-driven automation, performance systems, and intelligent growth infrastructure.";
  }

  // Pricing
  if (
    q.includes("pricing") ||
    q.includes("cost") ||
    q.includes("how much") ||
    q.includes("price")
  ) {
    return "Our pricing is customized based on scope, growth targets, and system complexity. Strategic proposals are delivered after evaluating your objectives.";
  }

  // Tagline
  if (q.includes("tagline")) {
    return "Transitioning your business to the digital age.";
  }

  // Target Market
  if (q.includes("ideal client") || q.includes("target market")) {
    return "We specialize in Real Estate, Travel & Tourism, and E-commerce brands seeking AI-powered growth systems.";
  }

  // Services overview (only if explicitly asking for list)
  if (
    q.includes("what services") ||
    q.includes("list your services") ||
    q === "services"
  ) {
    return `Digital Transition Marketing offers 14 AI-powered services:

1. Voice Search Optimization (VSO)
2. AI-Driven Email Marketing
3. AI-Powered YouTube Ad Domination
4. AI-Powered Website Design
5. AI Virtual Tours
6. AI-Powered Ad Warfare
7. AI Business Automation & Agents
8. Next-Level Music Production
9. Immersive CGI Marketing
10. AI Video and Audio Production
11. AI-Optimized Content
12. AI-Powered Social Domination
13. AI Search Domination (GEO & AI SEO)
14. AI Predictive Analytics`;
  }

  return null;
}

// ---------------- START SERVER ----------------
(async () => {
  try {
    await runApp(async (app: Application, httpServer: Server) => {
      app.use(cors({ origin: "*", credentials: true }));
      app.use(express.json({ limit: "10mb" }));
      app.use(express.urlencoded({ extended: true }));

      const publicPath = path.resolve(process.cwd(), "public");
      if (fs.existsSync(publicPath)) {
        app.use(express.static(publicPath));
        console.log("✅ Public folder served:", publicPath);
      }

      // -------- SMART CHAT ROUTE --------
      app.post("/chat", async (req, res) => {
        try {
          const { message, sessionId } = req.body;

          if (!message || !message.trim()) {
            return res.json({ answer: "Please provide a valid message." });
          }

          const cleanMessage = message.trim();

          // 1️⃣ Static intent first
          const staticResponse = detectStaticIntent(cleanMessage);
          if (staticResponse) {
            return res.json({ answer: staticResponse });
          }

          // 2️⃣ Embedding retrieval
          let knowledgeContext = "";
          try {
            const chunks = await fetchRelevantChunks(cleanMessage, 5);
            if (chunks && chunks.length > 0) {
              knowledgeContext = chunks
                .map((c) => c.summary)
                .join("\n\n");
            }
          } catch (err) {
            console.error("⚠️ Embedding retrieval error:", err);
          }

          // 3️⃣ Prepare final input for hybrid model
          const hybridInput = knowledgeContext
            ? `${knowledgeContext}\n\nUser Question: ${cleanMessage}`
            : cleanMessage;

          // 4️⃣ Hybrid LLM (Gemma + Gemini)
          const finalResponse = await generateHybridResponse(
            hybridInput,
            sessionId || "default"
          );

          return res.json({ answer: finalResponse });
        } catch (err) {
          console.error("❌ Chat route error:", err);
          return res.status(500).json({
            answer:
              "An internal error occurred. Please try again shortly.",
          });
        }
      });

      // Keep your existing routes
      await setupApp(app);

      const PORT = process.env.PORT || 5000;
      httpServer.listen(PORT, () =>
        console.log(`🌐 Server running on port ${PORT}`)
      );
    });

    console.log("✅ Server bootstrap complete");
  } catch (err) {
    console.error("❌ Server bootstrap failed:", err);
    process.exit(1);
  }
})();
