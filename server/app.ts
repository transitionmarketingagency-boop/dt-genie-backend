import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";

<<<<<<< HEAD
import router from "./routes";
=======
import router from "./routes.ts"; // Correct router import with .ts
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini.ts"; // Correct .ts import

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
=======
loader();
>>>>>>> 4f74436 (fix: update app.ts imports with .ts extensions for TypeScript resolution)
