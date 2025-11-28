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
export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map((m) => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(
    (h) => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );

export const getFormattedHistoryObjects = (
  history: ChatHistory[]
): ChatHistory[] => history.slice(-10).map((h) => ({ role: h.role, content: h.content }));

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
