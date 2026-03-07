// server/services/memoryService.ts
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import { ChatMessage } from "../../shared/types.js";
import crypto from "crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- Memory DB path ----------------
const memoryDir = path.join(__dirname, "../memory");
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
const dbPath = path.join(memoryDir, "chat_memory.db");

// ---------------- Open SQLite ----------------
const dbPromise = sqlite.open({ filename: dbPath, driver: sqlite3.Database });

// ---------------- Initialization ----------------
export async function initializeMemory(): Promise<void> {
  const db = await dbPromise;
  await db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_sessionId ON chat_messages (sessionId)`);
  console.log("✅ Memory DB initialized at:", dbPath);
}

// ---------------- Memory Service ----------------
export class MemoryService {
  // Add message to memory
  async addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatMessage> {
    const db = await dbPromise;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content: content ?? "",
      timestamp: new Date(),
    };

    const ts =
      msg.timestamp instanceof Date
        ? msg.timestamp.toISOString()
        : new Date(msg.timestamp).toISOString();

    // Corrected parameter order
    await db.run(
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      ts
    );

    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[Memory] Added message (${role}) for session ${sessionId}`);
    }

    return msg;
  }

  // Alias for hybrid response compatibility
  saveMessage(sessionId: string, role: "user" | "assistant", content: string) {
    return this.addMessage(sessionId, role, content);
  }

  // Get full session history
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const db = await dbPromise;
    const rows = await db.all(
      `SELECT * FROM chat_messages WHERE sessionId = ? ORDER BY timestamp ASC`,
      sessionId
    );
    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content,
      timestamp: new Date(r.timestamp),
    }));
  }

  // Save entire chat history (overwrite)
  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const db = await dbPromise;
    await db.exec("BEGIN TRANSACTION");
    try {
      await db.run(`DELETE FROM chat_messages WHERE sessionId = ?`, sessionId);

      const insertStmt = await db.prepare(`
        INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        const ts =
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : new Date(msg.timestamp).toISOString();
        await insertStmt.run(msg.id, msg.sessionId, msg.role, msg.content, ts);
      }

      await insertStmt.finalize();
      await db.exec("COMMIT");

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[Memory] Saved ${messages.length} messages for session ${sessionId}`);
      }
    } catch (err) {
      await db.exec("ROLLBACK");
      throw err;
    }
  }
}

// ---------------- Export singleton ----------------
export const memoryService = new MemoryService();
