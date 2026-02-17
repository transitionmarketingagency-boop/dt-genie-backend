// server/storage.ts
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import { ChatMessage } from "../shared/types.js";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export interface InsertChatMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
}

// Ensure memory folder exists
const MEMORY_DIR = path.join(process.cwd(), "server", "memory");
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

const DB_PATH = path.join(MEMORY_DIR, "chat_memory.db");

// Open sqlite database
const dbPromise = sqlite.open({
  filename: DB_PATH,
  driver: sqlite3.Database
});

// Initialize table and index
(async () => {
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
})();

export class Storage {
  async addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const db = await dbPromise;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: new Date(),
    };

    await db.run(
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      (msg.timestamp as Date).toISOString()
    );

    return msg;
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const db = await dbPromise;

    const rows = await db.all(
      `SELECT * FROM chat_messages
       WHERE sessionId = ?
       ORDER BY timestamp ASC`,
      sessionId
    );

    return rows.map(row => ({
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp)
    }));
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const db = await dbPromise;

    await db.run(`DELETE FROM chat_messages WHERE sessionId = ?`, sessionId);

    await db.exec('BEGIN TRANSACTION');
    try {
      const insertStmt = await db.prepare(`
        INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        await insertStmt.run(
          msg.id,
          msg.sessionId,
          msg.role,
          msg.content,
          (msg.timestamp as Date).toISOString()
        );
      }

      await insertStmt.finalize();
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  }
}

export const storage = new Storage();
