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

/* ---------------- Ensure memory folder exists ---------------- */
const memoryDir = path.join(__dirname, "../memory");
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

const dbPath = path.join(memoryDir, "chat_memory.db");

/* ---------------- Open sqlite database ---------------- */
const dbPromise = sqlite.open({
  filename: dbPath,
  driver: sqlite3.Database
});

/* ---------------- Initialize table safely ---------------- */
(async () => {
  try {
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

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessionId
      ON chat_messages (sessionId)
    `);

    console.log("✅ Memory DB ready");
  } catch (err) {
    console.error("❌ Memory DB initialization failed:", err);
  }
})();

export class MemoryService {
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
      timestamp: new Date()
    };

    await db.run(
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      (new Date(msg.timestamp)).toISOString()
    );

    return msg;
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const db = await dbPromise;

    const rows = await db.all(
      `
      SELECT * FROM chat_messages
      WHERE sessionId = ?
      ORDER BY timestamp DESC
      LIMIT 20
      `,
      sessionId
    );

    return rows
      .reverse()
      .map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp)
      }));
  }
}

export const memoryService = new MemoryService();
