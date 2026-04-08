import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import type { ChatMessage } from "../../shared/types.js";
import crypto from "crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= DB PATH ================= */
const memoryDir = path.join(__dirname, "../memory");
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
const dbPath = path.join(memoryDir, "chat_memory.db");

/* ================= SQLITE ================= */
const dbPromise = sqlite.open({
  filename: dbPath,
  driver: sqlite3.Database,
});

/* ================= LIMITS ================= */
const MAX_HISTORY_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 6;

/* ================= SAFE PARSE ================= */
function safeParse<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/* ================= NORMALIZE ================= */
function normalizeContent(text: unknown): string {
  if (typeof text !== "string") return "";
  let clean = text
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 4000);
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
  lastUserProblem?: string;
  lastDetectedServices?: string[];
  lastIntent?: string;
  updatedAt?: string;
  lastInteraction?: number; // timestamp
  bantSignals?: {
    budget?: number;
    authority?: number;
    need?: number;
    timeline?: number;
  };
}

/* ================= INIT ================= */
export async function initializeMemory(): Promise<void> {
  const db = await dbPromise;
  await db.exec(`PRAGMA journal_mode = WAL;`);
  await db.exec(`PRAGMA synchronous = NORMAL;`);
  await db.exec(`PRAGMA busy_timeout = 5000;`);

  await db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT,
      role TEXT,
      content TEXT,
      timestamp TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS strategic_memory (
      sessionId TEXT PRIMARY KEY,
      industry TEXT,
      businessType TEXT,
      goals TEXT,
      servicesDiscussed TEXT,
      leadScore REAL,
      stage TEXT,
      budget REAL,
      timeline TEXT,
      decisionMaker TEXT,
      interestLevel TEXT,
      lastUserProblem TEXT,
      lastDetectedServices TEXT,
      lastIntent TEXT,
      bantSignals TEXT,
      updatedAt TEXT,
      lastInteraction REAL
    )
  `);

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

  console.log("✅ Memory initialized");
}

/* ================= SERVICE ================= */
export class MemoryService {
  private db = dbPromise;

  /* -------- ADD MESSAGE -------- */
  async addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatMessage> {
    const db = await this.db;
    const normalized = normalizeContent(content);
    if (!normalized) throw new Error("Empty message");

    const last: any = await db.get(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT 1`,
      sessionId
    );

    if (last) {
      const same = normalizeContent(last.content) === normalized && last.role === role;
      const recent = Date.now() - new Date(last.timestamp).getTime() < 8000;
      if (same && recent) {
        return {
          id: last.id,
          sessionId,
          role,
          content: last.content,
          timestamp: new Date(last.timestamp),
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
      `INSERT INTO chat_messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      sessionId,
      role,
      normalized,
      now.toISOString()
    );

    await db.run(
      `DELETE FROM chat_messages WHERE sessionId=? AND id NOT IN (
        SELECT id FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT ?
      )`,
      sessionId,
      sessionId,
      MAX_HISTORY_MESSAGES
    );

    return msg;
  }

  async saveMessage(sessionId: string, role: "user" | "assistant", content: string) {
    return this.addMessage(sessionId, role, content);
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const db = await this.db;
    const rows = await db.all(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT ?`,
      sessionId,
      MAX_HISTORY_MESSAGES
    );
    return rows.reverse().map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content || "",
      timestamp: new Date(r.timestamp),
    }));
  }

  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {
    const db = await this.db;
    const rows = await db.all(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT ?`,
      sessionId,
      MAX_CONTEXT_MESSAGES
    );
    return rows.reverse().map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content || "",
      timestamp: new Date(r.timestamp),
    }));
  }

  /* ================= STRATEGIC ================= */
  async getStrategicMemory(sessionId: string): Promise<StrategicMemory> {
    const db = await this.db;
    const row = await db.get(`SELECT * FROM strategic_memory WHERE sessionId=?`, sessionId);
    if (!row) return {};

    const last = row.lastInteraction ? Number(row.lastInteraction) : null;
    const isStale = last && Date.now() - last > 24 * 60 * 60 * 1000;
    if (isStale) return {};

    return {
      industry: row.industry || undefined,
      businessType: row.businessType || undefined,
      goals: safeParse(row.goals, []),
      servicesDiscussed: safeParse(row.servicesDiscussed, []),
      leadScore: row.leadScore ?? undefined,
      stage: row.stage || undefined,
      budget: row.budget ?? undefined,
      timeline: row.timeline ?? undefined,
      decisionMaker: row.decisionMaker || undefined,
      interestLevel: row.interestLevel || undefined,
      lastUserProblem: row.lastUserProblem || undefined,
      lastDetectedServices: safeParse(row.lastDetectedServices, []),
      lastIntent: row.lastIntent || undefined,
      bantSignals: safeParse(row.bantSignals, {}),
      updatedAt: row.updatedAt || undefined,
      lastInteraction: row.lastInteraction ?? undefined,
    };
  }

  async updateStrategicMemory(sessionId: string, data: Partial<StrategicMemory>) {
    const db = await this.db;
    const existing = await this.getStrategicMemory(sessionId);

    const merged: StrategicMemory = {
      ...existing,
      ...data,
      goals: data.goals ?? existing.goals ?? [],
      servicesDiscussed: data.servicesDiscussed ?? existing.servicesDiscussed ?? [],
      lastDetectedServices: data.lastDetectedServices ?? existing.lastDetectedServices ?? [],
      bantSignals: {
        ...(existing.bantSignals || {}),
        ...(data.bantSignals || {}),
      },
      updatedAt: new Date().toISOString(),
      lastInteraction: Date.now(),
    };

    await db.run(
      `INSERT INTO strategic_memory (
        sessionId, industry, businessType, goals, servicesDiscussed, leadScore, stage, budget, timeline,
        decisionMaker, interestLevel, lastUserProblem, lastDetectedServices, lastIntent, bantSignals, updatedAt, lastInteraction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        lastUserProblem=excluded.lastUserProblem,
        lastDetectedServices=excluded.lastDetectedServices,
        lastIntent=excluded.lastIntent,
        bantSignals=excluded.bantSignals,
        updatedAt=excluded.updatedAt,
        lastInteraction=excluded.lastInteraction`,
      sessionId,
      merged.industry ?? null,
      merged.businessType ?? null,
      JSON.stringify(merged.goals),
      JSON.stringify(merged.servicesDiscussed),
      merged.leadScore ?? null,
      merged.stage ?? null,
      merged.budget ?? null,
      merged.timeline ?? null,
      merged.decisionMaker ?? null,
      merged.interestLevel ?? null,
      merged.lastUserProblem ?? null,
      JSON.stringify(merged.lastDetectedServices),
      merged.lastIntent ?? null,
      JSON.stringify(merged.bantSignals),
      merged.updatedAt,
      merged.lastInteraction
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
    const id = crypto.randomUUID();
    await db.run(
      `INSERT INTO bookings (id, userId, serviceType, preferredTime, email, calendlyLink, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.userId,
      data.serviceType ?? null,
      data.preferredTime ?? null,
      data.email ?? null,
      data.calendlyLink ?? null,
      data.status ?? "pending",
      new Date().toISOString()
    );
  }

  async updateBookingStatus(userId: string, status: string) {
    const db = await this.db;
    await db.run(`UPDATE bookings SET status=? WHERE userId=?`, status, userId);
  }
}

/* ================= SINGLETON ================= */
export const memoryService = new MemoryService();
