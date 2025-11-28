// server/app.ts

import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite } from "./index-dev";
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { generateEmbedding, chunkText } from "./services/embeddings";
import { crawlWebsite } from "./services/crawler";
import { parseFile } from "./services/fileParser";
import {
  chatRateLimiter,
  trainingRateLimiter,
  memoryRateLimiter
} from "./middleware/rateLimit";
import { askGemini } from "./services/gemini.js";

// --- Define interfaces for typed parameters ---
interface MemoryEntry {
  source: string;
  chunk: string;
}

interface ChatHistory {
  role: "assistant" | "user";
  content: string;
}

// --------------------
// Helper functions
// --------------------
const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m: MemoryEntry) => `[${m.source.toUpperCase()}] ${m.chunk}`);

const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map((h: ChatHistory) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`);

const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h: ChatHistory) => ({ role: h.role, content: h.content }));

// --------------------
// Main loader
// --------------------
const loader = async (): Promise<void> => {
  try {
    dotenv.config();

    const app: Application = express();

    app.use(cors());
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    const PORT: number = parseInt(process.env.PORT || "5000", 10);

    // Register backend routes
    const httpServer = await registerRoutes(app);

    // Setup Vite development server
    await setupVite(app, httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Example: process memory and chat history (for debugging)
    const memoryData: MemoryEntry[] = memoryStore.getMemory();
    console.log("Memory:", formatMemory(memoryData));

    const chatHistory: ChatHistory[] = storage.getHistory();
    console.log("History:", formatHistory(chatHistory));

    // Example Gemini API call
    const response = await askGemini("Hello world");
    console.log("Gemini response:", response);

  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

loader();
