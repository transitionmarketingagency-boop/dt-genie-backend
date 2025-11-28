// server/app.ts

import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./routes"; // <-- correct router import
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";

// --- Define interfaces ---
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

    // Mount all backend routes
    app.use("/", router);

    // Create HTTP server
    const http = require("http").createServer(app);

    http.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Debug memory + chat history
    try {
      const memoryData: MemoryEntry[] = memoryStore.getAllMemory(); // correct method
      console.log("Memory:", formatMemory(memoryData));
    } catch {
      console.log("No memory store initialized yet.");
    }

    try {
      const chatHistory: ChatHistory[] = storage.getAllHistory?.() || []; // safe accessor
      console.log("History:", formatHistory(chatHistory));
    } catch {
      console.log("No chat history yet.");
    }

    // Gemini test
    try {
      const reply = await queryGemini(message);
      console.log("Gemini response:", response);
    } catch {
      console.log("Gemini not configured.");
    }

  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

loader();

