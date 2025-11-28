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
import express, { Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, Server } from "http";
import { storage } from "./storage";
import { memoryStore } from "./memory";
import { queryGemini } from "./gemini"; 
import router from "../routes"; // import your routes
import type { MemoryEntry, ChatHistory } from "@shared/types";

dotenv.config();

// -------------------- Helpers --------------------
>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (
  history: ChatHistory[]
): ChatHistory[] => history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

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
export const setupApp = async (app: Express, sessionId: string) => {
>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Load memory + format
  const memoryData: MemoryEntry[] = memoryStore.getAllMemory() as MemoryEntry[];
  const formattedMemory = formatMemory(memoryData);

  // Load chat history
  const chatHistory: ChatHistory[] = await storage.getChatHistory(sessionId);
  const formattedHistory = formatHistory(chatHistory);

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

  // Apply rate limiters
  app.use("/chat", chatRateLimiter);

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
  app.get("/test-gemini", async (req, res) => {
    const reply: string = await queryGemini("Test message");
    res.json({ reply });
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
  app.set("trust proxy", 1); // for rate-limiting
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Apply routes from routes.ts
  app.use("/", router);

  // Health endpoint
  app.get("/api/health", (req, res) => {
    try {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        memory: memoryStore.getAllMemory().length,
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Health check failed" });
    }
  });

  // Call the optional setup function (like seeding memory or chat)
  if (setupFn) {
    await setupFn(app, httpServer);
  }

  return new Promise((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      resolve(httpServer);
    });
  });
}

>>>>>>> 2fd3fb1 (Fix app.ts route import: replace non-existent registerRoutes with router from routes.ts)
