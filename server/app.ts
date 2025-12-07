import express, { type Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, type Server } from "node:http";
import path from "path";

import { storage } from "./storage.js";
import { queryGemini } from "./services/gemini.js";
import { fetchRelevantChunks } from "./query-chunks.js"; 
import { populateChunks } from "./populate-chunks.js";
import sqlite3 from "sqlite3";

dotenv.config();

// -----------------------------
// Ensure chunks table exists
// -----------------------------
const dbPath = path.join(process.cwd(), "server/website_chunks.db");
const db = new sqlite3.Database(dbPath);
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'", (err, row) => {
  if (!row) {
    console.log("Chunks table missing — populating...");
    populateChunks();
  }
});
db.close();

// -----------------------------
// Setup API routes
// -----------------------------
export const setupApp = async (app: Application) => {
  app.use(cors({ origin: "*", credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Serve /public folder
  app.use("/public", express.static(path.join(process.cwd(), "public")));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Test route
  app.get("/test-gemini", (_req, res) => {
    res.json({ ok: true, message: "Gemini test route working!" });
  });

  // Chat endpoint
  app.post("/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      // Save user message
      await storage.addChatMessage({ sessionId, role: "user", content: message });

      // Fetch top 5 relevant chunks
      const chunks = await fetchRelevantChunks(message, 5);
      const contextText = chunks.map((c: any) => `${c.heading}\n${c.content}`).join("\n\n");

      // Build prompt
      const prompt = `Answer the user query based on the following website content:\n${contextText}\n\nUser Question: ${message}`;

      // Query Gemini
      const aiResponse = await queryGemini(prompt);

      // Save assistant response
      await storage.addChatMessage({ sessionId, role: "assistant", content: aiResponse });

      // Return response + full history
      const fullHistory = await storage.getChatHistory(sessionId);
      res.json({ ok: true, reply: aiResponse, history: fullHistory });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Chat failed" });
    }
  });
};

// -----------------------------
// Run server — Render-compatible
// -----------------------------
export default async function runApp(
  setupFn?: (app: Application, server: Server) => Promise<void>
): Promise<Server> {
  const app: Application = express();
  const httpServer = createServer(app);

  if (setupFn) await setupFn(app, httpServer);

  return httpServer;
}
