// server/index-prod.ts

import "dotenv/config";
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import { type Server } from "node:http";

import runApp, { setupApp } from "./app.js";
import { generateHybridResponse } from "./services/generateHybridResponse.js";
import { strategicBrain } from "./services/strategicBrain.js";
import { initializeMemory, memoryService } from "./services/memoryService.js";
import { initializeAIIntents } from "./services/json_loader.js";

/* ================= ENV VALIDATION ================= */
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}
console.log("✅ GEMINI_API_KEY loaded");

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY missing. Qwen embeddings may fail.");
} else {
  console.log("✅ OPENROUTER_API_KEY detected");
}

/* ================= PATH RESOLUTION ================= */
const ROOT_DIR = path.resolve();
const DIST_DIR = path.join(ROOT_DIR, "dist");
const VECTOR_DIR = path.join(DIST_DIR, "server", "vector_store");
const PUBLIC_DIR = path.join(DIST_DIR, "public");

/* ================= SYSTEM INITIALIZER ================= */
async function initializeSystem() {
  try {
    console.log(" ~@ Initializing Neon Vision AI system...");

    /* ---- Vector Store Check ---- */
    if (!fs.existsSync(VECTOR_DIR)) {
      console.error("❌ Vector store directory missing:", VECTOR_DIR);
      process.exit(1);
    }
    console.log("✅ Vector store found:", VECTOR_DIR);

    /* ---- Memory Init ---- */
    await initializeMemory();
    console.log("✅ Memory database initialized");

    /* ---- Load AI Intent JSON ---- */
    initializeAIIntents();
    console.log("✅ AI intents loaded");

  } catch (err) {
    console.error("❌ System initialization failed:", err);
    process.exit(1);
  }
}

/* ================= SERVER START ================= */
async function startServer() {

  await initializeSystem();

  await runApp(async (app: Application, httpServer: Server) => {

    /* -------- Middleware -------- */
    app.use(cors({ origin: "*", credentials: true }));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    /* -------- Static Files -------- */
    if (fs.existsSync(PUBLIC_DIR)) {
      app.use(express.static(PUBLIC_DIR));
      console.log("✅ Public folder served:", PUBLIC_DIR);
    }

    /* ================= CHAT ROUTE ================= */
    app.post("/chat", async (req: Request, res: Response) => {
      try {
        let { message, sessionId } = req.body as {
          message?: string;
          sessionId?: string;
        };

        if (!message || typeof message !== "string") {
          return res.status(400).json({ error: "Message is required" });
        }

        if (!sessionId || typeof sessionId !== "string") {
          sessionId = "default-session";
        }

        /* -------- Save user message to memory -------- */
        await memoryService.saveMessage(sessionId, "user", message);

        /* -------- Strategic Brain Analysis -------- */
        const { brainContext } = await strategicBrain(message, sessionId);

        console.log(
          `[Brain] Stage: ${brainContext.stage} | Intent: ${brainContext.intent} | LeadScore: ${brainContext.leadScore} | Reasoning: ${brainContext.reasoning}`
        );

        /* -------- Generate AI Response -------- */
        const reply = await generateHybridResponse({
          message,
          sessionId,
          history: await memoryService.getRecentContext(sessionId),
        });

        const finalReply =
          reply && reply.trim().length > 0
            ? reply
            : "I'm here to help with AI marketing strategy, automation, SEO, and CGI advertising. What would you like to explore?";

        /* -------- Save assistant response to memory -------- */
        await memoryService.saveMessage(sessionId, "assistant", finalReply);

        return res.json({ reply: finalReply });

      } catch (err) {
        console.error("❌ Chat route error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

    console.log("✅ Hybrid chat route initialized");

    /* -------- Additional Routes -------- */
    await setupApp(app);

    /* -------- Start Server -------- */
    const PORT = Number(process.env.PORT) || 10000;
    httpServer.listen(PORT, () => {
      console.log(` ~@ Neon Vision server running on port ${PORT}`);
    });

  });
}

/* ================= START ================= */
startServer();
