import { v4 as uuid } from "uuid";

export interface MemoryEntry {
  id: string;
  conversationId: string;
  chunk: string;
  source: "file" | "website" | "memory";
  embedding: number[];
  timestamp: Date;
}

interface ConversationMemory {
  conversationId: string;
  entries: MemoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

class MemoryStore {
  private conversations: Map<string, ConversationMemory> = new Map();

  addEntry(
    conversationId: string,
    chunk: string,
    source: "file" | "website" | "memory",
    embedding: number[]
  ): MemoryEntry {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        conversationId,
        entries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const memory = this.conversations.get(conversationId)!;
    const entry: MemoryEntry = {
      id: uuid(),
      conversationId,
      chunk,
      source,
      embedding,
      timestamp: new Date(),
    };

    memory.entries.push(entry);
    memory.updatedAt = new Date();

    return entry;
  }

  searchSimilar(embedding: number[], limit: number = 3): MemoryEntry[] {
    const allEntries: MemoryEntry[] = [];

    for (const conv of this.conversations.values()) {
      allEntries.push(...conv.entries);
    }

    // Cosine similarity
    const scored = allEntries.map(entry => {
      const similarity = this.cosineSimilarity(embedding, entry.embedding);
      return { entry, similarity };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.entry);
  }

  getConversationMemory(conversationId: string): MemoryEntry[] {
    return this.conversations.get(conversationId)?.entries || [];
  }

  getAllMemory(): ConversationMemory[] {
    return Array.from(this.conversations.values());
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
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
