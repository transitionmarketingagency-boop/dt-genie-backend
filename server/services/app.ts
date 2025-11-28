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
import { askGemini } from "./services/gemini.js";
import type { MemoryEntry, ChatHistory } from "@shared/types"; // add interfaces

// --- Example interfaces if you haven't created them ---
interface MemoryEntry {
  source: string;
  chunk: string;
}

interface ChatHistory {
  role: "assistant" | "user";
  content: string;
}

// --------------------
// Example usage
// --------------------

export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m: MemoryEntry) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h: ChatHistory) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h: ChatHistory) => ({
    role: h.role,
    content: h.content
  }));

export const getTotalEntries = (all: { entries: any[] }[]): number =>
  all.reduce((sum: number, c: { entries: any[] }) => sum + c.entries.length, 0);

export const getConversations = (all: any[]): any[] => all.map((c: any) => ({ ...c }));

// --------------------
// Example server setup using these functions
// --------------------

export const setupApp = async (app: express.Application) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Example memory processing
  const memoryData: MemoryEntry[] = memoryStore.getMemory();
  const formattedMemory = formatMemory(memoryData);

  // Example chat history
  const chatHistory: ChatHistory[] = storage.getHistory();
  const formattedHistory = formatHistory(chatHistory);
  const historyObjects = getFormattedHistoryObjects(chatHistory);

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

  // Example rate-limiter usage
  app.use("/chat", chatRateLimiter);

  // Example Gemini API call
  const response = await askGemini("Hello world");
  console.log("Gemini response:", response);
};


