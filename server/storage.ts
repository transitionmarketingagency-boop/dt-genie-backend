// server/storage.ts
import { randomUUID } from "crypto";
import { User, InsertUser, ChatMessage, InsertChatMessage } from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getChatHistory(sessionId: string): Promise<ChatMessage[]>;
  addChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
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

export const storage = new MemStorage();

