// shared/types.ts

export interface MemoryEntry {
  id: string;
  conversationId: string;
  chunk: string;
  source: "file" | "website" | "memory" | "manual";
  embedding?: number[];
  timestamp: Date;
}

export interface ConversationMemory extends MemoryEntry {
  created_at: string;
  updatedAt?: Date;
  key?: string;
  value?: any;
}

export interface ChatHistory {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessage extends ChatHistory {
  id: string;
  sessionId: string;
  timestamp: Date;
}
