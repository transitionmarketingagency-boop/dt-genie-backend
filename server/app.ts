import express, { type Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, type Server } from "node:http";

import { storage } from "./storage";
import { queryGemini } from "./services/gemini";

dotenv.config();

// Setup API routes
export const setupApp = async (app: Application) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Test Gemini route
  app.get("/test-gemini", (_req, res) => {
    res.json({ ok: true, message: "Gemini test route working!" });
  });

  // Chat endpoint
  app.post("/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      await storage.addChatMessage({ sessionId, role: "user", content: message });
      const aiResponse = await queryGemini(message);
      await storage.addChatMessage({ sessionId, role: "assistant", content: aiResponse });
      const fullHistory = await storage.getChatHistory(sessionId);
      res.json({ ok: true, reply: aiResponse, history: fullHistory });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: "Chat failed" });
    }
  });
};

// Run server
export default async function runApp(
  setupFn?: (app: Application, server: Server) => Promise<void>
): Promise<Server> {
  const app: Application = express();
  const PORT = parseInt(process.env.PORT || "5000", 10);
  const httpServer = createServer(app);

  if (setupFn) await setupFn(app, httpServer);

  return new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}
