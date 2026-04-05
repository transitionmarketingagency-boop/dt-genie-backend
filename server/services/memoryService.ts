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
const MAX_CONTEXT_MESSAGES = 5;

/* ================= SAFE JSON PARSE ================= */

function safeParse<T = any>(value: unknown): T | undefined {
  if (!value || typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/* ================= INITIALIZATION ================= */

export async function initializeMemory(): Promise<void> {
  try {
    const db = await dbPromise;

    await db.exec(`PRAGMA journal_mode = WAL;`);
    await db.exec(`PRAGMA synchronous = NORMAL;`);
    await db.exec(`PRAGMA busy_timeout = 5000;`);

    /* ================= CHAT TABLE ================= */

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

    /* ================= STRATEGIC MEMORY ================= */

    await db.run(`
      CREATE TABLE IF NOT EXISTS strategic_memory (
        sessionId TEXT PRIMARY KEY,
        industry TEXT,
        businessType TEXT,
        goals TEXT,
        servicesDiscussed TEXT,
        leadScore INTEGER,
        stage TEXT,
        budget REAL,
        timeline TEXT,
        decisionMaker TEXT,
        interestLevel TEXT,
        updatedAt TEXT
      )
    `);

    /* ================= BOOKINGS TABLE ================= */

    await db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        userId TEXT,
        serviceType TEXT,
        preferredTime TEXT,
        email TEXT,
        calendlyLink TEXT,
        status TEXT,
        createdAt TEXT
      )
    `);

    /* ================= BOOKING INDEX ================= */

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_booking_user
      ON bookings (userId, createdAt)
    `);

    console.log("✅ Memory DB initialized at:", dbPath);

  } catch (err) {
    console.error("❌ Failed to initialize memory DB:", err);
  }
}

/* ================= NORMALIZE CONTENT ================= */

function normalizeContent(text: unknown): string {
  if (typeof text !== "string" || !text.trim()) return "";
  // Normalize and remove control characters
  let normalized = text
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Truncate safely without breaking surrogate pairs
  return [...normalized].slice(0, 4000).join("");
}

/* ================= TYPES ================= */

export interface StrategicMemory {
  industry?: string;
  businessType?: string;
  goals?: string[];
  servicesDiscussed?: string[];
  leadScore?: number;
  stage?: string;
  budget?: number;
  timeline?: string;
  decisionMaker?: string;
  interestLevel?: string;
  updatedAt?: string;

  bantSignals?: {
    budget?: number;
    authority?: number;
    need?: number;
    timeline?: number;
  };
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

    if (!normalized) {
      throw new Error("Attempted to store empty message");
    }

    const last = await db.get(
      `SELECT content, timestamp
       FROM chat_messages
       WHERE sessionId = ?
       ORDER BY datetime(timestamp) DESC
       LIMIT 1`,
      sessionId
    );

    if (last) {

      const lastTime = new Date(last.timestamp).getTime();
      const nowTime = Date.now();

const lastTimestamp = new Date(last.timestamp);
const lastNormalized = normalizeContent(last.content);

if (!isNaN(lastTimestamp.getTime()) &&
    lastNormalized === normalized &&
    nowTime - lastTimestamp.getTime() < 5000 // slightly longer window
) {
  if (process.env.DEBUG_MEMORY === "true") {
    console.log(`[Memory] Skipped duplicate message for session ${sessionId}`);
  }
  return {
    id: last.id,
    sessionId,
    role,
    content: normalized,
    timestamp: lastTimestamp,
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
      `INSERT INTO chat_messages
      (id, sessionId, role, content, timestamp)
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
         SELECT id
         FROM chat_messages
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


/* -------- Optional wrapper to maintain backward compatibility -------- */
saveMessage(sessionId: string, role: "user" | "assistant", content: string) {
  return this.addMessage(sessionId, role, content);
}


  /* -------- Get Full History -------- */

  async getHistory(sessionId: string): Promise<ChatMessage[]> {

    try {

      const db = await this.db;

      const rows = await db.all(
        `SELECT *
         FROM chat_messages
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

  /* -------- Context Window -------- */

  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {

    try {

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

      console.error(
        `❌ Failed to get recent context for session ${sessionId}:`,
        err
      );

      return [];

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

    let bant: StrategicMemory["bantSignals"] = undefined;

bant = {
  budget: typeof row.budget === "number" ? row.budget : undefined,
  authority: row.bantSignals?.authority ?? (row.decisionMaker?.trim() ? 1 : undefined),
  need: row.bantSignals?.need ?? (row.interestLevel?.trim() ? 0.6 : undefined),
  timeline: row.bantSignals?.timeline ?? (row.timeline?.trim() ? 0.6 : undefined),
};

    return {
      industry: row.industry || undefined,
      businessType: row.businessType || undefined,
      goals: row.goals ? safeParse(row.goals) : undefined,
      servicesDiscussed: row.servicesDiscussed ? safeParse(row.servicesDiscussed) : undefined,
      leadScore: row.leadScore ?? undefined,
      stage: row.stage || undefined,
      budget: row.budget ?? undefined,
      timeline: row.timeline ?? undefined,
      decisionMaker: row.decisionMaker ?? undefined,
      interestLevel: row.interestLevel ?? undefined,
      updatedAt: row.updatedAt || undefined,
      bantSignals: bant,
    };

  }

  async updateStrategicMemory(
    sessionId: string,
    data: Partial<StrategicMemory>
  ) {

    const db = await this.db;

    const existing = await this.getStrategicMemory(sessionId);

const merged: StrategicMemory = {
  ...existing,
  ...data,
  goals: data.goals !== undefined ? data.goals : existing.goals,
  servicesDiscussed: data.servicesDiscussed !== undefined ? data.servicesDiscussed : existing.servicesDiscussed,
  bantSignals: { ...existing.bantSignals, ...data.bantSignals }, // ✅ Preserve BANT
  updatedAt: new Date().toISOString(),
};

    await db.run(
      `INSERT INTO strategic_memory
       (sessionId, industry, businessType, goals, servicesDiscussed, leadScore, stage, budget, timeline, decisionMaker, interestLevel, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sessionId) DO UPDATE SET
         industry=excluded.industry,
         businessType=excluded.businessType,
         goals=excluded.goals,
         servicesDiscussed=excluded.servicesDiscussed,
         leadScore=excluded.leadScore,
         stage=excluded.stage,
         budget=excluded.budget,
         timeline=excluded.timeline,
         decisionMaker=excluded.decisionMaker,
         interestLevel=excluded.interestLevel,
         updatedAt=excluded.updatedAt`,
      sessionId,
      merged.industry ?? null,
      merged.businessType ?? null,
      merged.goals ? JSON.stringify(merged.goals) : null,
      merged.servicesDiscussed ? JSON.stringify(merged.servicesDiscussed) : null,
      merged.leadScore ?? null,
      merged.stage ?? null,
      merged.budget ?? null,
      merged.timeline ?? null,
      merged.decisionMaker ?? null,
      merged.interestLevel ?? null,
      merged.updatedAt
    );

  }

  /* ================= BOOKINGS ================= */

  async storeBooking(data: {
    userId: string;
    serviceType?: string;
    preferredTime?: string;
    email?: string;
    calendlyLink?: string;
    status?: string;
  }) {

    const db = await this.db;

if (!data.userId || !data.userId.trim()) {
  throw new Error("Booking must include a valid userId");
}

const bookingId = crypto.randomUUID();
const createdAt = new Date().toISOString();

await db.run(
  `INSERT INTO bookings
   (id, userId, serviceType, preferredTime, email, calendlyLink, status, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  bookingId,
  data.userId,
  data.serviceType ?? null,
  data.preferredTime ?? null,
  data.email ?? null,
  data.calendlyLink ?? null,
  data.status ?? "pending",
  createdAt
);


    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[Memory] Booking stored for ${data.userId}`);
    }
  }

  async updateBookingStatus(userId: string, status: string) {

    const db = await this.db;

    await db.run(
      `UPDATE bookings
       SET status = ?
       WHERE id = (
         SELECT id
         FROM bookings
         WHERE userId = ?
         ORDER BY datetime(createdAt) DESC
         LIMIT 1
       )`,
      status,
      userId
    );

    if (process.env.DEBUG_MEMORY === "true") {
      console.log(`[Memory] Booking updated for ${userId} -> ${status}`);
    }

  }

}

/* ================= SINGLETON ================= */

export const memoryService = new MemoryService();
