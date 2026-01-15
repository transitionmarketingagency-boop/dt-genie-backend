// server/storage.ts
import Database from "better-sqlite3";
import { ChatMessage } from "../shared/types";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export interface InsertChatMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
}

// ensure memory folder exists
const MEMORY_DIR = path.join(process.cwd(), "server", "memory");
if (!fs.existsSync(MEMORY_DIR)) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

const DB_PATH = path.join(MEMORY_DIR, "chat_memory.db");

// open sqlite db
const db = new Database(DB_PATH);

// ensure table exists (safe on every boot)
db.prepare(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_sessionId
  ON chat_messages (sessionId)
`).run();

export class Storage {
  async addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      timestamp: new Date(),
    };

    db.prepare(`
      INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      msg.timestamp.toISOString()
    );

    return msg;
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const rows = db.prepare(`
      SELECT * FROM chat_messages
      WHERE sessionId = ?
      ORDER BY timestamp ASC
    `).all(sessionId);

    return rows.map((row: any) => ({
      ...row,
      timestamp: new Date(row.timestamp),
    }));
  }

  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    db.prepare(`DELETE FROM chat_messages WHERE sessionId = ?`).run(sessionId);

    const insert = db.prepare(`
      INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const trx = db.transaction((msgs: ChatMessage[]) => {
      for (const msg of msgs) {
        insert.run(
          msg.id,
          msg.sessionId,
          msg.role,
          msg.content,
          msg.timestamp.toISOString()
        );
      }
    });

    trx(messages);
  }
}

export const storage = new Storage();
