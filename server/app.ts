import express, { type Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, type Server } from "node:http";

// ✅ Add .js extensions for Node ESM
import { storage } from "./storage.js";
import { queryGemini } from "./services/gemini.js";
import path from "path";  // ✅ REQUIRED for static folder resolution

dotenv.config();

// -----------------------------
// Setup API routes
// -----------------------------
export const setupApp = async (app: Application) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // -----------------------------------------------------
  // ✅ ADD THIS — Serve /public folder correctly on Render
  // -----------------------------------------------------
  app.use(
    "/public",
    express.static(path.join(process.cwd(), "public"))
  );
  // -----------------------------------------------------

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

      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message,
      });

      const aiResponse = await queryGemini(message);

      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse,
      });

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
  // Render's index-prod.js will call server.listen()
  return httpServer;
}
