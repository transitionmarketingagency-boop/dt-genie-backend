import express, { type Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, type Server } from "node:http";

// ✅ Add .js extensions for Node ESM
import { storage } from "./storage.js";
import { queryGemini } from "./services/gemini.js";
import { fetchRelevantChunks } from "./query-chunks.js"; // ✅ fetch website content
import { populateChunks } from "./populate-chunks.js"; // ✅ populate DB on startup
import path from "path";  // ✅ REQUIRED for static folder resolution

dotenv.config();

// -----------------------------
// Setup API routes
// -----------------------------
export const setupApp = async (app: Application) => {
  // ✅ Updated CORS: allow all origins (frontend websites) for testing
  app.use(cors({
    origin: "*",
    credentials: true
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // -----------------------------------------------------
  // ✅ Serve /public folder correctly on Render
  // -----------------------------------------------------
  app.use(
    "/public",
    express.static(path.join(process.cwd(), "public"))
  );
  // -----------------------------------------------------

  // ✅ Auto-populate chunks table if not exists
  await populateChunks();

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Test route
  app.get("/test-gemini", (_req, res) => {
    res.json({ ok: true, message: "Gemini test route working!" });
  });

  // Chat endpoint — fetch website chunks
  app.post("/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      // 1️⃣ Save user message
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
      });

      // 2️⃣ Fetch top 5 relevant chunks from website
      const chunks = await fetchRelevantChunks(message, 5);
      let contextText = chunks.map((c: any) => `${c.heading}\n${c.content}`).join("\n\n");

      // 3️⃣ Build prompt for Gemini
      let prompt = `Answer the user query based on the following website content:\n${contextText}\n\nUser Question: ${message}`;

      // 4️⃣ Query Google Gemini
      const aiResponse = await queryGemini(prompt);

      // 5️⃣ Save assistant response
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse,
      });

      // 6️⃣ Return response + full history
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
// ❗ DOES NOT START LISTENING
// -----------------------------
export default async function runApp(
  setupFn?: (app: Application, server: Server) => Promise<void>
): Promise<Server> {
  const app: Application = express();
  const httpServer = createServer(app);

  // Keep the original 2-argument signature
  if (setupFn) await setupFn(app, httpServer);

  // ❗ Return the server WITHOUT calling listen()
  return httpServer;
}
