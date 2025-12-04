// server/storage.ts
import { ChatMessage } from "../shared/types";

export interface InsertChatMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
}

export class Storage {
  private chatMessages: Map<string, ChatMessage[]> = new Map();

  async addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: new Date(),
    };

    const messages = this.chatMessages.get(message.sessionId) || [];
    messages.push(msg);
    this.chatMessages.set(message.sessionId, messages);

    return msg;
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(sessionId) || [];
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    this.chatMessages.set(sessionId, messages);
  }
}

export const storage = new Storage();
