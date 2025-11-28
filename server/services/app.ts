// server/services/app.ts

import express from "express";
import cors from "cors";
import { storage } from "./storage";
import { memoryStore } from "./services/memory";
import { queryGemini } from "./services/gemini";
import { generateEmbedding, chunkText } from "./services/embeddings";
import { crawlWebsite } from "./services/crawler";
import { parseFile } from "./services/fileParser";
import {
  chatRateLimiter,
  trainingRateLimiter,
  memoryRateLimiter
} from "./middleware/rateLimit";

import type { MemoryEntry, ChatHistory } from "@shared/types";

// --------------------
// Helper functions
// --------------------
export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

export const getTotalEntries = (all: { entries: any[] }[]): number =>
  all.reduce((sum, c) => sum + c.entries.length, 0);

export const getConversations = (all: any[]): any[] => all.map((c) => ({ ...c }));

// --------------------
// Server setup
// --------------------
export const setupApp = async (app: express.Application) => {
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Memory
  const memoryData: MemoryEntry[] = memoryStore.getMemory();
  const formattedMemory = formatMemory(memoryData);

  // Chat history
  const chatHistory: ChatHistory[] = storage.getHistory();
  const formattedHistory = formatHistory(chatHistory);
  const historyObjects = getFormattedHistoryObjects(chatHistory);

  console.log("Memory:", formattedMemory);
  console.log("History:", formattedHistory);

  // Example rate-limiter usage
  app.use("/chat", chatRateLimiter);

  // Gemini API call
  try {
    const response = await queryGemini("Hello world");
    console.log("Gemini response:", response);
  } catch (err) {
    console.error("Gemini call failed:", err);
  }
};
