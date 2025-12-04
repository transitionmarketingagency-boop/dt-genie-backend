import { MemoryEntry, ChatHistory } from "../../shared/types";

export const formatMemory = (memory: MemoryEntry[]): string[] =>
  memory.slice(-20).map(m => `[${m.source.toUpperCase()}] ${m.chunk}`);

export const formatHistory = (history: ChatHistory[]): string[] =>
  history.slice(-10).map(h => `${h.role === "assistant" ? "Assistant" : "User"}: ${h.content}`);

export const getFormattedHistoryObjects = (history: ChatHistory[]): ChatHistory[] =>
  history.slice(-10).map(h => ({ role: h.role, content: h.content }));
