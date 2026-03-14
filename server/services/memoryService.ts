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
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

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

    // Chat messages table
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

    // Strategic memory table
    await db.run(`
      CREATE TABLE IF NOT EXISTS strategic_memory (
        sessionId TEXT PRIMARY KEY,
        industry TEXT,
        businessType TEXT,
        goals TEXT,
        servicesDiscussed TEXT,
        leadScore INTEGER,
        stage TEXT,
        updatedAt TEXT
      )
    `);

    console.log("✅ Memory DB initialized at:", dbPath);
  } catch (err) {
    console.error("❌ Failed to initialize memory DB:", err);
  }
}

/* ================= NORMALIZE CONTENT ================= */
function normalizeContent(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

/* ================= TYPES ================= */
export interface StrategicMemory {
  industry?: string;
  businessType?: string;
  goals?: string[];
  servicesDiscussed?: string[];
  leadScore?: number;
  stage?: string;
  updatedAt?: string;
}

/* ================= MEMORY SERVICE ================= */
export class MemoryService {
  private db = dbPromise;

  /* -------- Add / Save Message -------- */
  async addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatMessage> {
    const db = await this.db;
    const normalized = normalizeContent(content);
    if (!normalized) throw new Error("Attempted to store empty message");

    /* ===== DUPLICATE GUARD ===== */
    const last = await db.get(
      `SELECT content, timestamp FROM chat_messages
       WHERE sessionId = ?
       ORDER BY datetime(timestamp) DESC
       LIMIT 1`,
      sessionId
    );

    if (last) {
      const lastTime = new Date(last.timestamp).getTime();
      const nowTime = Date.now();
      if (last.content === normalized && nowTime - lastTime < 3000) {
        return {
          id: crypto.randomUUID(),
          sessionId,
          role,
          content: normalized,
          timestamp: new Date(),
        };
      }
    }

    const now = new Date();
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content: normalized,
      timestamp: now,
    };

    await db.run(
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      now.toISOString()
    );

    /* ===== PRUNE OLD MESSAGES ===== */
    await db.run(
      `DELETE FROM chat_messages
       WHERE sessionId = ?
       AND id NOT IN (
         SELECT id FROM chat_messages
         WHERE sessionId = ?
         ORDER BY datetime(timestamp) DESC
         LIMIT ?
       )`,
      sessionId,
      sessionId,
      MAX_HISTORY_MESSAGES
    );

    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[Memory] Added (${role}) message for session ${sessionId}`);
    }

    return msg;
  }

  saveMessage(sessionId: string, role: "user" | "assistant", content: string) {
    return this.addMessage(sessionId, role, content);
  }

  /* -------- Get Full Conversation History -------- */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const db = await this.db;
      const rows = await db.all(
        `SELECT * FROM chat_messages
         WHERE sessionId = ?
         ORDER BY datetime(timestamp) DESC
         LIMIT ?`,
        sessionId,
        MAX_HISTORY_MESSAGES
      );

      return rows.reverse().map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content ?? "",
        timestamp: new Date(r.timestamp),
      }));
    } catch (err) {
      console.error(`❌ Failed to get history for session ${sessionId}:`, err);
      return [];
    }
  }

  /* -------- Get Recent Context Window -------- */
  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {
    try {
      const db = await this.db;
      const rows = await db.all(
        `SELECT * FROM chat_messages
         WHERE sessionId = ?
         ORDER BY datetime(timestamp) DESC
         LIMIT ?`,
        sessionId,
        MAX_CONTEXT_MESSAGES
      );

      const messages: ChatMessage[] = rows.reverse().map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content ?? "",
        timestamp: new Date(r.timestamp),
      }));

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(
          `[Memory] Retrieved ${messages.length} recent messages for session ${sessionId}`
        );
      }

      return messages;
    } catch (err) {
      console.error(`❌ Failed to get recent context for session ${sessionId}:`, err);
      return [];
    }
  }

  /* -------- Replace Entire History -------- */
  async saveChatHistory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const db = await this.db;
    await db.exec("BEGIN TRANSACTION");
    try {
      await db.run(`DELETE FROM chat_messages WHERE sessionId = ?`, sessionId);
      const insertStmt = await db.prepare(
        `INSERT INTO chat_messages (id, sessionId, role, content, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      );

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
    } catch (err) {
      await db.exec("ROLLBACK");
      console.error("❌ Failed to save chat history:", err);
    }
  }

  /* ================= STRATEGIC MEMORY ================= */

  async getStrategicMemory(sessionId: string): Promise<StrategicMemory> {
    const db = await this.db;
    const row = await db.get(
      `SELECT * FROM strategic_memory WHERE sessionId = ?`,
      sessionId
    );
    if (!row) return {};
    return {
      industry: row.industry || undefined,
      businessType: row.businessType || undefined,
      goals: row.goals ? JSON.parse(row.goals) : undefined,
      servicesDiscussed: row.servicesDiscussed ? JSON.parse(row.servicesDiscussed) : undefined,
      leadScore: row.leadScore ?? undefined,
      stage: row.stage || undefined,
      updatedAt: row.updatedAt || undefined,
    };
  }

  async updateStrategicMemory(sessionId: string, data: Partial<StrategicMemory>) {
    const db = await this.db;
    const existing = await this.getStrategicMemory(sessionId);

    const merged = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await db.run(
      `INSERT INTO strategic_memory (sessionId, industry, businessType, goals, servicesDiscussed, leadScore, stage, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sessionId) DO UPDATE SET
         industry=excluded.industry,
         businessType=excluded.businessType,
         goals=excluded.goals,
         servicesDiscussed=excluded.servicesDiscussed,
         leadScore=excluded.leadScore,
         stage=excluded.stage,
         updatedAt=excluded.updatedAt`,
      sessionId,
      merged.industry ?? null,
      merged.businessType ?? null,
      merged.goals ? JSON.stringify(merged.goals) : null,
      merged.servicesDiscussed ? JSON.stringify(merged.servicesDiscussed) : null,
      merged.leadScore ?? null,
      merged.stage ?? null,
      merged.updatedAt
    );
  }
}

/* ================= SINGLETON ================= */
export const memoryService = new MemoryService();
