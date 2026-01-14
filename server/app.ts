import 'dotenv/config';
import fs from "fs";
import path from "path";

// =====================================================
// GOOGLE SERVICE ACCOUNT SETUP (KEEP AS-IS LOGIC)
// =====================================================
if (process.env.SERVICE_ACCOUNT_BASE64) {
  const json = Buffer
    .from(process.env.SERVICE_ACCOUNT_BASE64, "base64")
    .toString("utf8");

  const keyPath = path.join(process.cwd(), "sa-key.json");

  fs.writeFileSync(keyPath, json);

  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

// =====================================================
// NORMAL IMPORTS (AFTER ENV + SA SETUP)
// =====================================================
import express, { type Application } from "express";
import cors from "cors";
import { createServer, type Server } from "node:http";

// ✅ Local imports (ESM-safe)
import { storage } from "./storage.js";
import { queryGemini } from "./services/gemini.js";
import { fetchRelevantChunks } from "./query-chunks.js";
import { populateChunks } from "./populate-chunks.js";

// =====================================================
// Setup API routes
// =====================================================
export const setupApp = async (app: Application) => {
  app.use(cors({
    origin: "*",
    credentials: true
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // -----------------------------------------------------
  // Serve /public folder
  // -----------------------------------------------------
  app.use(
    "/public",
    express.static(path.join(process.cwd(), "public"))
  );

  // -----------------------------------------------------
  // Populate chunks on startup
  // -----------------------------------------------------
  if (process.env.POPULATE_CHUNKS === "true") {
    await populateChunks();
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Test route
  app.get("/test-gemini", (_req, res) => {
    res.json({ ok: true, message: "Gemini test route working!" });
  });

  // -----------------------------------------------------
  // Chat endpoint
  // -----------------------------------------------------
  app.post("/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      // 1️⃣ Save user message
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
      });

      // 2️⃣ Fetch relevant chunks
      const chunks = await fetchRelevantChunks(message, 5);

      // ✅ STEP 1 — CLEAN CONTEXT
      const contextText = chunks
        .map((c: any, i: number) => `SOURCE ${i + 1}:\n${c.content.trim()}`)
        .join("\n\n");

      // ✅ STEP 2 — IMPROVED PROMPT
      const prompt = `
You are NeonVision, the AI assistant for Digital Transition Marketing.

Your job is to clearly explain the company's services using the website content below.
The content may be fragmented, scraped, or unstructured — you must intelligently summarize it.

If services are described across multiple sections, combine them into a clear, confident explanation.
Do NOT say you cannot answer unless there is truly zero service-related information.

WEBSITE CONTENT:
${contextText}

USER QUESTION:
${message}

Answer in a professional, confident marketing tone.
      `.trim();

      // 4️⃣ Query Gemini
      const aiResponse = await queryGemini(prompt);

      // 5️⃣ Save assistant response
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse,
      });

      // 6️⃣ Return response
      const fullHistory = await storage.getChatHistory(sessionId);
      res.json({ ok: true, reply: aiResponse, history: fullHistory });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Chat failed" });
    }
  });
};

// =====================================================
// Render-compatible server creator (UNCHANGED LOGIC)
// =====================================================
export default async function runApp(
  setupFn?: (app: Application, server: Server) => Promise<void>
): Promise<Server> {
  const app: Application = express();
  const httpServer = createServer(app);

  if (setupFn) {
    await setupFn(app, httpServer);
  } else {
    await setupApp(app);
  }

  return httpServer;
}

// =====================================================
// ✅ START SERVER WHEN RUN DIRECTLY (LOCAL DEV FIX)
// =====================================================
if (process.argv[1].includes("app.ts")) {
  const PORT = Number(process.env.PORT) || 5000;

  const app = express();
  const server = createServer(app);

  setupApp(app).then(() => {
    server.listen(PORT, () => {
      console.log(` ~@ Server running on http://localhost:${PORT}`);
    });
  });
}
