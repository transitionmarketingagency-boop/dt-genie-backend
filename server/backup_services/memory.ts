import { ConversationMemory } from "../../shared/types";

export class MemoryStore {
  private memory: ConversationMemory[] = [];

  addMemory(mem: ConversationMemory) {
    this.memory.push(mem);
  }

  getAllMemory(): ConversationMemory[] {
    return [...this.memory];
  }

  getMemoryById(id: string): ConversationMemory | undefined {
    return this.memory.find(m => m.id === id);
  }
}

export const memoryStore = new MemoryStore();
