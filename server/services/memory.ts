import { v4 as uuid } from "uuid";

export interface MemoryEntry {
  id: string;
  conversationId: string;
  chunk: string;
  source: "file" | "website" | "memory" | "manual";
  embedding?: number[];
  timestamp: Date;
}

export interface ConversationMemory {
  id: string; // ✅ added id
  conversationId: string;
  key?: string; // optional for testMemory
  value?: any;  // optional for testMemory
  chunk: string;
  source: "file" | "website" | "memory" | "manual";
  created_at: string;
  updatedAt?: Date;
}

class MemoryStore {
  private conversations: Map<string, ConversationMemory> = new Map();

  // Add memory entry from test data
  addMemory(entry: ConversationMemory) {
    if (!entry.id) entry.id = uuid();
    this.conversations.set(entry.id, entry);
  }

  addEntry(
    conversationId: string,
    chunk: string,
    source: "file" | "website" | "memory",
    embedding: number[]
  ): MemoryEntry {
    const id = uuid();
    const entry: MemoryEntry = {
      id,
      conversationId,
      chunk,
      source,
      embedding,
      timestamp: new Date(),
    };
    this.conversations.set(id, {
      id,
      conversationId,
      chunk,
      source,
      created_at: new Date().toISOString(),
    });
    return entry;
  }

  searchSimilar(embedding: number[], limit: number = 3): MemoryEntry[] {
    const allEntries: MemoryEntry[] = [];
    for (const conv of this.conversations.values()) {
      if ("embedding" in conv && conv.embedding) {
        allEntries.push(conv as MemoryEntry);
      }
    }

    const scored = allEntries.map(entry => {
      const similarity = this.cosineSimilarity(embedding, entry.embedding!);
      return { entry, similarity };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.entry);
  }

  getConversationMemory(conversationId: string): MemoryEntry[] {
    return Array.from(this.conversations.values())
      .filter(conv => conv.conversationId === conversationId)
      .map(conv => conv as MemoryEntry);
  }

  getAllMemory(): ConversationMemory[] {
    return Array.from(this.conversations.values());
  }

  clearConversation(conversationId: string): void {
    for (const [id, conv] of this.conversations.entries()) {
      if (conv.conversationId === conversationId) {
        this.conversations.delete(id);
      }
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magA && magB ? dotProduct / (magA * magB) : 0;
  }
}

export const memoryStore = new MemoryStore();
