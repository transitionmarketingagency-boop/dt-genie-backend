import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";

import router from "./routes";
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";

interface MemoryEntry {
  source: string;
  chunk: string;
}

interface ChatHistory {
  role: "assistant" | "user";
  content: string;
}

const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

const loader = async (): Promise<void> => {
  try {
    dotenv.config();

    const app: Application = express();
    app.use(cors());
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ limit: "10mb", extended: true }));

    const PORT: number = parseInt(process.env.PORT || "5000", 10);

    app.use("/", router);

    const http = require("http").createServer(app);
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
      const reply = await queryGemini("Say hello! This is a Gemini test.");
      console.log("Gemini response:", reply);
    } catch {
      console.log("Gemini not configured.");
    }
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

loader();