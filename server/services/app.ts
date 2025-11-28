// server/services/app.ts

import express from "express";
import cors from "cors";
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
import { queryGemini } from "./services/gemini"; // ✅ CORRECT IMPORT
import type { MemoryEntry, ChatHistory } from "@shared/types";

// --------------------
// Helpers
// --------------------

export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({
    role: h.role,
    content: h.content
  }));

// --------------------
// Setup Express App
// --------------------

export const setupApp = async (
  app: express.Application,
  sessionId: string
) => {
  // --------------------
  // Middleware
  // --------------------
  app.use(cors()); // types fixed via custom.d.ts
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // --------------------
  // MEMORY
  // --------------------
  // Ensure memoryStore.getAllMemory() returns MemoryEntry[]
  const memoryData: MemoryEntry[] = memoryStore.getAllMemory();
  const formattedMemory = formatMemory(memoryData);

  // --------------------
  // CHAT HISTORY
  // --------------------
  const chatHistory: ChatHistory[] = await storage.getChatHistory(sessionId);
  const formattedHistory = formatHistory(chatHistory);

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

  // --------------------
  // RATE LIMITERS
  // --------------------
  app.use("/chat", chatRateLimiter);

  // --------------------
  // GEMINI CALL (queryGemini)
  // --------------------
  const message: string = "Hello world from backend"; // properly scoped
  const response: string = await queryGemini(message);

  console.log("Gemini reply:", response);
};
