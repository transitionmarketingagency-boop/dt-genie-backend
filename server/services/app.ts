// server/services/app.ts
import { MemoryEntry, ChatHistory } from "../../shared/types.js";

/**
 * Format memory entries for prompts or logging
 */
export const formatMemory = (memory: MemoryEntry[]): string[] => {
  return memory.slice(-20).map(m => `[${m.source.toUpperCase()}] ${m.chunk}`);
};

/**
 * Format chat history for display/logging
 */
export const formatHistory = (history: ChatHistory[]): string[] => {
  return history.slice(-10).map(h =>
    `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`
  );
};

/**
 * Get last 10 chat history objects for structured API calls
 */
export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] => {
  return history.slice(-10).map(h => ({ role: h.role, content: h.content }));
};
