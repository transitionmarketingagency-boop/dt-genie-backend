// shared/types.ts

export interface MemoryEntry {
  source: string;
  chunk: string;
}

export interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}
