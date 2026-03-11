// server/services/memoryService.ts

import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import type { ChatMessage } from "../../shared/types.js";
import crypto from "crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/* ================= PATH RESOLUTION ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= MEMORY PATH ================= */

const memoryDir = path.join(__dirname, "../memory");

if (!fs.existsSync(memoryDir)) {
  fs.mkdirSync(memoryDir, { recursive: true });
}

const dbPath = path.join(memoryDir, "chat_memory.db");

/* ================= SQLITE CONNECTION ================= */

const dbPromise = sqlite.open({
  filename: dbPath,
  driver: sqlite3.Database,
});

/* ================= MEMORY LIMITS ================= */

const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 8;

/* ================= INITIALIZATION ================= */

export async function initializeMemory(): Promise<void> {
  try {

    const db = await dbPromise;

    await db.exec(`PRAGMA journal_mode = WAL;`);
    await db.exec(`PRAGMA synchronous = NORMAL;`);

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

    console.log("✅ Memory DB initialized at:", dbPath);

  } catch (err) {
    console.error("❌ Failed to initialize memory DB:", err);
  }
}

/* ================= NORMALIZE CONTENT ================= */

function normalizeContent(text: string): string {

  if (!text) return "";

  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/* ================= MEMORY SERVICE ================= */

export class MemoryService {

  private db = dbPromise;

  /* -------- Add Message -------- */

  async addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatMessage> {

    const db = await this.db;

    const normalized = normalizeContent(content);

    if (!normalized) {
      throw new Error("Attempted to store empty message");
    }

    const now = new Date();

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content: normalized,
      timestamp: now,
    };

    const ts = now.toISOString();

    await db.run(
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      ts
    );

    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[Memory] Added (${role}) message for session ${sessionId}`);
    }

    return msg;
  }

  /* -------- Alias used by chatbot -------- */

  saveMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ) {
    return this.addMessage(sessionId, role, content);
  }

  /* -------- Get Full Conversation History -------- */

  async getHistory(sessionId: string): Promise<ChatMessage[]> {

    const db = await this.db;

    const rows = await db.all(
      `SELECT *
       FROM chat_messages
       WHERE sessionId = ?
       ORDER BY datetime(timestamp) ASC
       LIMIT ?`,
      sessionId,
      MAX_HISTORY_MESSAGES
    );

    const messages: ChatMessage[] = rows.map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content ?? "",
      timestamp: new Date(r.timestamp),
    }));

    if (process.env.DEBUG_MEMORY === "true") {
      console.log(
        `[Memory] Retrieved ${messages.length} messages for session ${sessionId}`
      );
    }

    return messages;
  }

  /* -------- Get Recent Context Window -------- */

  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {

    const db = await this.db;

    const rows = await db.all(
      `SELECT *
       FROM chat_messages
       WHERE sessionId = ?
       ORDER BY datetime(timestamp) DESC
       LIMIT ?`,
      sessionId,
      MAX_CONTEXT_MESSAGES
    );

    const messages: ChatMessage[] = rows
      .reverse()
      .map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content ?? "",
        timestamp: new Date(r.timestamp),
      }));

    return messages;
  }

  /* -------- Replace Entire History -------- */

  async saveChatHistory(
    sessionId: string,
    messages: ChatMessage[]
  ): Promise<void> {

    const db = await this.db;

    await db.exec("BEGIN TRANSACTION");

    try {

      await db.run(
        `DELETE FROM chat_messages WHERE sessionId = ?`,
        sessionId
      );

      const insertStmt = await db.prepare(`
        INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {

        const ts =
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : new Date(msg.timestamp).toISOString();

        await insertStmt.run(
          msg.id,
          msg.sessionId,
          msg.role,
          normalizeContent(msg.content),
          ts
        );
      }

      await insertStmt.finalize();

      await db.exec("COMMIT");

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(
          `[Memory] Saved ${messages.length} messages for session ${sessionId}`
        );
      }

    } catch (err) {

      await db.exec("ROLLBACK");

      console.error("❌ Failed to save chat history:", err);
    }
  }
}

/* ================= SINGLETON ================= */

export const memoryService = new MemoryService();
