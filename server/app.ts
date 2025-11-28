<<<<<<< HEAD
import express, { Application } from "express";
=======
// server/app.ts
<<<<<<< HEAD
import express, { Application, Request, Response } from "express";
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
=======
import express, { Express } from "express";
>>>>>>> f493617 (fix: rewrite server/app.ts to remove registerRoutes, correct router import, fix memory/history methods, and stabilize Express server)
import cors from "cors";
import dotenv from "dotenv";
import { createServer, Server } from "http";

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import router from "./routes";
=======
import router from "./routes.ts"; // Correct router import with .ts
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
=======
import router from "./routes.ts"; // router import with .ts
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
=======
import router from "./routes.ts"; // Correct router import with .ts
>>>>>>> f493617 (fix: rewrite server/app.ts to remove registerRoutes, correct router import, fix memory/history methods, and stabilize Express server)
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini.ts"; // Correct .ts import
import type { MemoryEntry, ChatHistory } from "@shared/types";

<<<<<<< HEAD
=======
dotenv.config();

<<<<<<< HEAD
// -------------------- Interfaces --------------------
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
interface MemoryEntry {
  source: string;
  chunk: string;
}

interface ChatHistory {
  role: "assistant" | "user";
  content: string;
}

<<<<<<< HEAD
const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

const formatHistory = (history: ChatHistory[]): string[] =>
=======
=======
>>>>>>> f493617 (fix: rewrite server/app.ts to remove registerRoutes, correct router import, fix memory/history methods, and stabilize Express server)
// -------------------- Helper functions --------------------
export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

<<<<<<< HEAD
<<<<<<< HEAD
const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

=======
export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

// -------------------- Main loader --------------------
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
const loader = async (): Promise<void> => {
  try {
    const app: Application = express();
<<<<<<< HEAD
=======
    const PORT = parseInt(process.env.PORT || "5000", 10);

>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
    app.use(cors());
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

<<<<<<< HEAD
<<<<<<< HEAD
    const PORT: number = parseInt(process.env.PORT || "5000", 10);

=======
    // Mount all backend routes
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
    app.use("/", router);

    const http = require("http").createServer(app);
<<<<<<< HEAD
=======

    const PORT: number = parseInt(process.env.PORT || "5000", 10);
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
=======
    // Apply backend routes
    app.use("/", router);
=======
export const getFormattedHistoryObjects = (
  history: ChatHistory[]
): ChatHistory[] => history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

// -------------------- Setup App --------------------
export const setupApp = async (app: Express, sessionId: string) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // MEMORY
  const memoryData: MemoryEntry[] = memoryStore.getAllMemory() as MemoryEntry[];
  const formattedMemory = formatMemory(memoryData);

  // CHAT HISTORY
  const chatHistory: ChatHistory[] = await storage.getChatHistory(sessionId);
  const formattedHistory = formatHistory(chatHistory);
>>>>>>> f493617 (fix: rewrite server/app.ts to remove registerRoutes, correct router import, fix memory/history methods, and stabilize Express server)

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

<<<<<<< HEAD
>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
    http.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Debug memory + chat history
    try {
      const memoryData: MemoryEntry[] = memoryStore.getAllMemory();
      console.log("Memory:", formatMemory(memoryData));
    } catch {
      console.log("No memory store initialized yet.");
    }

    try {
      const chatHistory: ChatHistory[] = storage.getAllHistory?.() || [];
      console.log("History:", formatHistory(chatHistory));
    } catch {
      console.log("No chat history yet.");
    }

    // Gemini test
    try {
<<<<<<< HEAD
      const reply = await queryGemini("Say hello! This is a Gemini test.");
      console.log("Gemini response:", reply);
=======
      const message = "Hello from backend";
      const response = await queryGemini(message);
      console.log("Gemini response:", response);
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
    } catch {
      console.log("Gemini not configured.");
    }
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

<<<<<<< HEAD
loader();
<<<<<<< HEAD
=======
loader();
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
=======
=======
  // GEMINI CALL
  const message: string = "Hello from backend";
  const response: string = await queryGemini(message);
  console.log("Gemini reply:", response);

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
>>>>>>> f493617 (fix: rewrite server/app.ts to remove registerRoutes, correct router import, fix memory/history methods, and stabilize Express server)

>>>>>>> ef3954f (fix(server): add TypeScript types to app.ts to remove implicit any errors  - Added interfaces for MemoryEntry and ChatHistory - Typed all map and reduce callbacks - Typed express app and PORT variables - Cleaned async loader with Promise<void>)
