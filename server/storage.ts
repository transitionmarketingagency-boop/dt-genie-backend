<<<<<<< HEAD
import { randomUUID } from "crypto";
<<<<<<< HEAD
import type { User, InsertUser, ChatMessage, InsertChatMessage } from "@shared/schema";
=======
import type { User, InsertUser, ChatMessage, InsertChatMessage } from "../shared/schema"; // type-only import
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)
=======
// server/storage.ts
>>>>>>> 8eb4c8f (Add memory and chat history endpoints to the chatbot backend)

import { randomUUID } from "crypto";
import type {
  User,
  InsertUser,
  ChatMessage,
  InsertChatMessage
} from "../shared/schema";

// -----------------------------
// STORAGE INTERFACE
// -----------------------------
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Added in feature branch — keep it
  saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void>;
}

// -----------------------------
// IN-MEMORY STORAGE IMPLEMENTATION
// -----------------------------
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private chatMessages = new Map<string, ChatMessage[]>();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return [...this.users.values()].find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { id, ...insertUser };
    this.users.set(id, user);
    return user;
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return [...(this.chatMessages.get(sessionId) || [])];
  }

  async addChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      id,
      timestamp: new Date(),
      ...insertMessage
    };

    const existing = this.chatMessages.get(insertMessage.sessionId) || [];
    existing.push(message);
    this.chatMessages.set(insertMessage.sessionId, existing);

    return message;
  }

  // ----------------------------------
  // 🔥 Required for chat persistence
  // ----------------------------------
  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    this.chatMessages.set(sessionId, [...messages]);
  }
}

// Singleton instance for app usage
export const storage = new MemStorage();
