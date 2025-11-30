<<<<<<< HEAD
import express from "express";
import cors from "cors";

import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";
import {
  chatRateLimiter,
  trainingRateLimiter,
  memoryRateLimiter
} from "./middleware/rateLimit";

import type { ChatMessage } from "@shared/schema";
import type { MemoryEntry, ChatHistory } from "@shared/types";

// --------------------
// Helper functions
// --------------------
=======
// server/services/app.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, Server } from "http";

import { storage } from "./storage";
import { memoryStore } from "./memory";
import { queryGemini } from "./gemini";
import router from "../routes";
import type { MemoryEntry, ChatHistory } from "@shared/types";

dotenv.config();

// -------------------- Helpers --------------------
>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map(m => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    h => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (
  history: ChatHistory[]
): ChatHistory[] => history.slice(-10).map(h => ({ role: h.role, content: h.content }));

<<<<<<< HEAD
// --------------------
// User message processor
// --------------------
export async function processUserMessage(
  sessionId: string,
  userMessage: string
): Promise<ChatMessage[]> {
  // Save user message
  await storage.addChatMessage({
    role: "user",
    content: userMessage,
    sessionId
  });

  // Generate assistant response
  const aiResponse = await queryGemini(userMessage);

  // Save assistant response
  await storage.addChatMessage({
    role: "assistant",
    content: aiResponse,
    sessionId
  });

  // Return updated chat history
  return storage.getChatHistory(sessionId);
}

// --------------------
// Express App Setup
// --------------------
export const setupApp = async (
  app: express.Application,
  sessionId: string
) => {
  // Middleware
=======
// -------------------- Setup App --------------------
<<<<<<< HEAD
export const setupApp = async (app: Express, sessionId: string) => {
>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
=======
export const setupApp = async (app: Express, sessionId?: string) => {
>>>>>>> 2491800 (fix(services): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for memory entries and chat history - Typed all map, reduce, and callback parameters - Fixed imports to ensure proper type checking - Improved type safety across service functions)
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

<<<<<<< HEAD
  // Load memory + format
  const memoryData: MemoryEntry[] = memoryStore.getAllMemory() as MemoryEntry[];
  const formattedMemory = formatMemory(memoryData);

<<<<<<< HEAD
  // Load chat history
  const chatHistory: ChatHistory[] = await storage.getChatHistory(sessionId);
=======
  // CHAT HISTORY
=======
  // -------------------- MEMORY --------------------
  const rawMemory = memoryStore.getAllMemory?.() ?? [];
  const memoryData: MemoryEntry[] = rawMemory.map(m => ({
    source: (m as any).source ?? "unknown",
    chunk: (m as any).chunk ?? (m as any).content ?? ""
  }));

  const formattedMemory = formatMemory(memoryData);

  // -------------------- CHAT HISTORY --------------------
<<<<<<< HEAD
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
  const chatHistory: ChatHistory[] = sessionId ? await storage.getChatHistory(sessionId) : [];
>>>>>>> 2491800 (fix(services): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for memory entries and chat history - Typed all map, reduce, and callback parameters - Fixed imports to ensure proper type checking - Improved type safety across service functions)
=======
  const chatHistory: ChatHistory[] = sessionId
    ? await storage.getChatHistory(sessionId)
    : [];

>>>>>>> 8eb4c8f (Add memory and chat history endpoints to the chatbot backend)
  const formattedHistory = formatHistory(chatHistory);

  console.log("Raw memory example:", rawMemory[0]);
  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

<<<<<<< HEAD
<<<<<<< HEAD
  // Apply rate limiters
  app.use("/chat", chatRateLimiter);
=======
  // GEMINI CALL
=======
  // -------------------- GEMINI CALL --------------------
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
  try {
    const message = "Hello from backend";
    const response = await queryGemini(message);
    console.log("Gemini reply:", response);
  } catch (err) {
    console.error("Gemini query failed:", err);
  }
>>>>>>> 2491800 (fix(services): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for memory entries and chat history - Typed all map, reduce, and callback parameters - Fixed imports to ensure proper type checking - Improved type safety across service functions)

<<<<<<< HEAD
<<<<<<< HEAD
  // GEMINI test call
  const testMsg = "Hello world from backend";
  const testReply = await queryGemini(testMsg);
  console.log("Gemini reply:", testReply);

  // Test route
  app.get(
    "/test-gemini",
    async (req: express.Request, res: express.Response) => {
      const reply = await queryGemini("Test message");
      res.json({ reply });
    }
  );
};
=======
  // TEST ROUTE
  app.get("/test-gemini", async (_req: Request, res: Response) => {
=======
  // -------------------- TEST ROUTE --------------------
<<<<<<< HEAD
  app.get("/test-gemini", async (req: Request, res: Response) => {
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
=======
  app.get("/test-gemini", async (_req, res) => {
>>>>>>> 8eb4c8f (Add memory and chat history endpoints to the chatbot backend)
    try {
      const reply = await queryGemini("Test message");
      res.json({ ok: true, reply });
    } catch (err) {
      console.error("Test route error:", err);
      res.status(500).json({ ok: false, error: "Gemini test failed" });
    }
  });

  // --------------------------------------------------
  // 🔥 REAL CHAT ENDPOINT (widget uses this)
  // --------------------------------------------------
  app.post("/chat", async (req, res) => {
    try {
      const { message, sessionId } = req.body;

      // 1. Store user message
      await storage.addChatMessage({
        sessionId,
        role: "user",
        content: message
      });

      // 2. AI response
      const aiResponse = await queryGemini(message);

      // 3. Store assistant message
      await storage.addChatMessage({
        sessionId,
        role: "assistant",
        content: aiResponse
      });

      // 4. Save updated history
      const fullHistory = await storage.getChatHistory(sessionId);
      await storage.saveChatHistory(sessionId, fullHistory);

      // 5. Return response
      res.json({ ok: true, reply: aiResponse });
    } catch (err) {
      console.error("Chat route error:", err);
      res.status(500).json({ ok: false, error: "Chat failed" });
    }
  });
};

// -------------------- Main App --------------------
export default async function runApp(
  setupFn?: (app: Express, server: Server) => Promise<void>
): Promise<Server> {
  const app: Express = express();
  const PORT = parseInt(process.env.PORT || "5000", 10);
  const httpServer = createServer(app);

  // Core middleware
  app.use(cors());
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Routes
  app.use("/", router);

  // Health endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    try {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        memory: memoryStore.getAllMemory().length
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // Optional setup (static serving in production)
  if (setupFn) {
    await setupFn(app, httpServer);
  }

  return new Promise(resolve => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}

<<<<<<< HEAD
>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
=======

<<<<<<< HEAD

>>>>>>> 2491800 (fix(services): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for memory entries and chat history - Typed all map, reduce, and callback parameters - Fixed imports to ensure proper type checking - Improved type safety across service functions)
=======
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
