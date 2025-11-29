// server/app.ts

import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./routes";
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";

// --- Interfaces ---
interface MemoryEntry {
  source: string;
  chunk: string;
}

interface ChatHistory {
  role: "assistant" | "user";
  content: string;
}

// --- Formatting helpers ---
const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map((h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`);

const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

// -----------------------------
// Main Loader
// -----------------------------
const loader = async (): Promise<void> => {
  try {
    dotenv.config();

    const app: Application = express();

    app.use(cors());
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    const PORT: number = parseInt(process.env.PORT || "5000", 10);

    // Mount backend routes
    app.use("/", router);

    // --- Gemini debugging test route ---
    app.get("/test-gemini", async (req, res) => {
      try {
        const reply = await queryGemini("Say hello! This is a Gemini test.");
        res.json({ ok: true, reply });
      } catch (err) {
        console.error("Gemini test route error:", err);
        res.status(500).json({ ok: false, error: "Gemini test failed" });
      }
    });

    // Start server
    const http = require("http").createServer(app);

    http.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Memory debug
    try {
      const memoryData = memoryStore.getAllMemory?.() || [];
      console.log("Memory:", formatMemory(memoryData));
    } catch {
      console.log("No memory store found.");
    }

    // Chat history debug
    try {
      // NOT storage.getAllHistory — that does not exist
      console.log("Chat history loaded (per session only).");
    } catch {
      console.log("No chat history yet.");
    }

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

loader();
