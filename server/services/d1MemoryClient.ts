import type { ChatMessage } from "../../shared/types.js";
import type { StrategicMemory } from "./memoryService.js";

type ApiMessage = Omit<ChatMessage, "timestamp"> & { timestamp: string };

class D1MemoryClient {
  private get config() {
    const baseUrl = process.env.NEONVISION_MEMORY_URL?.replace(/\/$/, "");
    const token = process.env.NEONVISION_MEMORY_TOKEN;
    if (!baseUrl || !token) throw new Error("D1 memory is enabled but its URL/token is not configured");
    return { baseUrl, token };
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const { baseUrl, token } = this.config;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`D1 memory request failed (${response.status})`);
    return await response.json() as T;
  }

  async initialize(): Promise<void> {
    const { baseUrl } = this.config;
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("D1 memory health check failed");
  }

  async addMessage(sessionId: string, role: "user" | "assistant", content: string) {
    const result = await this.request<{ saved: boolean; message?: ApiMessage }>("/v1/messages/add", { sessionId, role, content });
    if (!result.message) return null;
    return { ...result.message, timestamp: new Date(result.message.timestamp) } as ChatMessage;
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const result = await this.request<{ messages: ApiMessage[] }>("/v1/messages/history", { sessionId });
    return (result.messages || []).map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as ChatMessage[];
  }

  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {
    const result = await this.request<{ messages: ApiMessage[] }>("/v1/messages/context", { sessionId });
    return (result.messages || []).map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as ChatMessage[];
  }

  async getRecentMessages(sessionId: string, limit = 4): Promise<ChatMessage[]> {
    const result = await this.request<{ messages: ApiMessage[] }>("/v1/messages/recent", { sessionId, limit });
    return (result.messages || []).map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as ChatMessage[];
  }

  async getStrategicMemory(sessionId: string): Promise<StrategicMemory> {
    const result = await this.request<{ memory: StrategicMemory }>("/v1/strategic/get", { sessionId });
    return result.memory || {};
  }

  async updateStrategicMemory(sessionId: string, data: Partial<StrategicMemory>): Promise<void> {
    await this.request("/v1/strategic/upsert", { sessionId, data });
  }

  async storeBooking(data: {
    userId: string; serviceType?: string; preferredTime?: string;
    email?: string; calendlyLink?: string; status?: string;
  }): Promise<void> {
    await this.request("/v1/bookings/create", data);
  }

  async updateBookingStatus(bookingId: string, status: string): Promise<void> {
    await this.request("/v1/bookings/status", { bookingId, status });
  }
}

export const d1MemoryClient = new D1MemoryClient();
