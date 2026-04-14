import "dotenv/config";
import fs from "fs";
import path from "path";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import { type Server } from "node:http";

import runApp, { setupApp } from "./app.js";
import { executeHybridResponse } from "./services/generateHybridResponse.js";
import { strategicBrain } from "./services/strategicBrain.js";
import { initializeMemory, memoryService } from "./services/memoryService.js";
import { initializeAIIntents } from "./services/json_loader.js";

/* ================= TYPES ================= */
interface BrainContext {
  stage?: string;
  intent?: string;
  leadScore?: number;
  reasoning?: string;
}

/* ================= ENV VALIDATION ================= */
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}
console.log("✅ GEMINI_API_KEY loaded");

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY missing. Embeddings may fail.");
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

    if (!fs.existsSync(VECTOR_DIR)) {
      console.error("❌ Vector store missing:", VECTOR_DIR);
      process.exit(1);
    }

    console.log("✅ Vector store found:", VECTOR_DIR);

    await initializeMemory();
    console.log("✅ Memory initialized");

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
    app.use(cors({ origin: "*", credentials: true }));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true }));

    if (fs.existsSync(PUBLIC_DIR)) {
      app.use(express.static(PUBLIC_DIR));
      console.log("✅ Public folder served:", PUBLIC_DIR);
    }

    /* ================= CHAT ROUTE ================= */
    app.post("/chat", async (req: Request, res: Response) => {
      try {
        const { message, sessionId: rawSessionId } = req.body as {
          message?: string;
          sessionId?: string;
        };

        if (!message || typeof message !== "string") {
          return res
            .status(400)
            .json({ error: "Message is required" });
        }

        const sessionId =
          rawSessionId && typeof rawSessionId === "string"
            ? rawSessionId
            : "default-session";

        /* ================= MEMORY SAVE ================= */
        await memoryService.addMessage(sessionId, "user", message).catch(() => {});

        /* ================= STRATEGIC BRAIN ================= */
        let brainContext: BrainContext = {};

        try {
          const brainResult = await strategicBrain(message, sessionId);
          brainContext = brainResult?.brainContext || {};
        } catch (err) {
          console.warn("⚠️ Strategic brain failed:", err);
        }

        /* ================= HISTORY ================= */
        const history = await memoryService
          .getRecentContext(sessionId)
          .catch(() => []);

        const historyText =
          history.map((h: any) => h.content).join("\n") || "";

        /* ================= HYBRID RESPONSE ================= */
        let reply = "";

        try {
          reply = await executeHybridResponse({
            sessionId,
            message,
            brainContext,
            leadScoreValue: brainContext.leadScore ?? 0,
            detectedIntentNames: brainContext.intent
              ? [brainContext.intent]
              : [],
            vectorText: "", // still empty until real vector pipeline is added
            historyText,
            recentMessagesCache: history || [],
            intentCategories: [],
          });
        } catch (err) {
          console.warn("⚠️ Hybrid response failed:", err);
        }

        const finalReply =
          reply && reply.trim().length > 0
            ? reply
            : "I’m here to help with AI marketing, automation, SEO, and CGI ads. What do you want to build?";

        await memoryService
          .addMessage(sessionId, "assistant", finalReply)
          .catch(() => {});

        return res.json({ reply: finalReply });
      } catch (err) {
        console.error("❌ Chat route error:", err);
        return res
          .status(500)
          .json({ error: "Internal server error" });
      }
    });

    console.log("✅ Hybrid chat route initialized");

    await setupApp(app);

    const PORT = Number(process.env.PORT) || 10000;

    httpServer.listen(PORT, () => {
      console.log(` ~@ Neon Vision server running on port ${PORT}`);
    });
  });
}

/* ================= START ================= */
startServer();
