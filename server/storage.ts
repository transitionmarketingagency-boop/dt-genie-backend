import { randomUUID } from "crypto";
<<<<<<< HEAD
import type { User, InsertUser, ChatMessage, InsertChatMessage } from "@shared/schema";
=======
import type { User, InsertUser, ChatMessage, InsertChatMessage } from "../shared/schema"; // type-only import
>>>>>>> 3d7de80 (Resolve conflicts: update server and shared configs)

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private chatMessages = new Map<string, ChatMessage[]>();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
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
    const message: ChatMessage = { id, timestamp: new Date(), ...insertMessage };

    const existing = this.chatMessages.get(insertMessage.sessionId) || [];
    existing.push(message);
    this.chatMessages.set(insertMessage.sessionId, existing);

    return message;
  }
}

// Singleton instance
export const storage = new MemStorage();
