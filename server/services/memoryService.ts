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

/* ================= HELPERS ================= */

function normalizeContent(text: unknown): string {
  if (typeof text !== "string") return "";

  return text
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000); // reduced slightly (prevents payload pollution)
}

/* 🔥 CRITICAL FIX: block dataset / garbage leaks */
function isGarbage(text: string): boolean {
  if (!text) return true;

  return (
    text.includes('"intent"') ||
    text.includes('"examples"') ||
    text.includes('"response"') ||
    text.includes('"category"') ||
    text.includes("FAQ [") ||
    text.includes("Source:") ||
    text.includes("Phase ") ||
    text.length > 2000
  );
}

function isLowValue(text: string): boolean {
  if (!text) return true;
  if (text.length < 10) return true;
  if (/^(ok|yes|no|hi|hello|hey)$/i.test(text)) return true;
  return false;
}

/* 🔥 improved context shift */
function detectIndustry(message: string): string | null {
  const msg = message.toLowerCase();

  if (msg.includes("saas")) return "saas";
  if (msg.includes("ecom")) return "ecommerce";
  if (msg.includes("real estate")) return "real_estate";
  if (msg.includes("hotel")) return "hospitality";

  return null;
}

function isContextShift(message: string, existing?: string): boolean {
  const detected = detectIndustry(message);
  if (!detected || !existing) return false;
  return detected !== existing;
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify(null);
  }
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
  lastInteraction?: number;
  isStale?: boolean;

  conversionProbability?: number;
  ctaReadiness?: number;
  intentMomentum?: number;

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
      conversionProbability REAL,
      ctaReadiness REAL,
      intentMomentum REAL,
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

  /* ---------- ADD MESSAGE ---------- */
  async addMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ) {
    const db = await this.db;
    const normalized = normalizeContent(content);

    if (!normalized || isGarbage(normalized)) return null;

    const last = await db.get(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT 1`,
      sessionId
    );

    if (last) {
      const isDuplicate =
        normalizeContent(last.content) === normalized &&
        Date.now() - new Date(last.timestamp).getTime() < 5000;

      if (isDuplicate) return null;
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
      `INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)`,
      msg.id,
      sessionId,
      role,
      normalized,
      now.toISOString()
    );

    return msg;
  }

  async saveMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string
  ) {
    return this.addMessage(sessionId, role, content);
  }

  /* ---------- HISTORY ---------- */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const db = await this.db;

    const rows = await db.all(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) ASC LIMIT ?`,
      sessionId,
      MAX_HISTORY_MESSAGES
    );

    return rows.map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content,
      timestamp: new Date(r.timestamp),
    }));
  }

  /* ---------- CONTEXT ---------- */
  async getRecentContext(sessionId: string): Promise<ChatMessage[]> {
    const db = await this.db;

    const rows = await db.all(
      `SELECT * FROM chat_messages WHERE sessionId=? ORDER BY datetime(timestamp) DESC LIMIT 15`,
      sessionId
    );

    return rows
      .filter((r: any) => !isLowValue(r.content) && !isGarbage(r.content))
      .slice(0, MAX_CONTEXT_MESSAGES)
      .reverse()
      .map((r: any) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content,
        timestamp: new Date(r.timestamp),
      }));
  }

/* ---------- RECENT MESSAGES (CRITICAL FIX) ---------- */
async getRecentMessages(
  sessionId: string,
  limit: number = 4
): Promise<ChatMessage[]> {
  const db = await this.db;

  const rows = await db.all(
    `SELECT * FROM chat_messages 
     WHERE sessionId=? 
     ORDER BY datetime(timestamp) DESC 
     LIMIT ?`,
    sessionId,
    limit * 2 // 🔥 fetch extra to filter garbage
  );

  return rows
    .filter((r: any) => {
      if (!r?.content) return false;

      const text = r.content.trim();

      // ❌ remove garbage / system leaks
      if (isGarbage(text)) return false;

      // ❌ remove low-value noise
      if (isLowValue(text)) return false;

      return true;
    })
    .slice(0, limit)
    .reverse()
    .map((r: any) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      content: r.content,
      timestamp: new Date(r.timestamp),
    }));
}

  /* ---------- STRATEGIC MEMORY ---------- */
  async getStrategicMemory(sessionId: string): Promise<StrategicMemory> {
    const db = await this.db;

    const row = await db.get(
      `SELECT * FROM strategic_memory WHERE sessionId=?`,
      sessionId
    );

    if (!row) return {};

    const last = Number(row.lastInteraction || 0);
    const isStale = Date.now() - last > 24 * 60 * 60 * 1000;

    return {
      industry: row.industry,
      businessType: row.businessType,
      goals: safeParse(row.goals, []),
      servicesDiscussed: safeParse(row.servicesDiscussed, []),
      leadScore: row.leadScore,
      stage: row.stage,
      budget: row.budget,
      timeline: row.timeline,
      decisionMaker: row.decisionMaker,
      interestLevel: row.interestLevel,
      lastUserProblem: row.lastUserProblem,
      lastDetectedServices: safeParse(row.lastDetectedServices, []),
      lastIntent: row.lastIntent,
      bantSignals: safeParse(row.bantSignals, {}),
      conversionProbability: row.conversionProbability,
      ctaReadiness: row.ctaReadiness,
      intentMomentum: row.intentMomentum,
      updatedAt: row.updatedAt,
      lastInteraction: last,
      isStale,
    };
  }

  /* ✅ RESTORED (FIXES YOUR ERROR) */
  async updateStrategicMemory(
    sessionId: string,
    data: Partial<StrategicMemory>
  ) {
    const db = await this.db;
    const existing = await this.getStrategicMemory(sessionId);

    if (
      data.lastUserProblem &&
      isContextShift(data.lastUserProblem, existing.industry)
    ) {
      await db.run(`DELETE FROM strategic_memory WHERE sessionId=?`, sessionId);
    }

    const merged: StrategicMemory = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
      lastInteraction: Date.now(),
    };

    await db.run(
      `INSERT INTO strategic_memory VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       conversionProbability=excluded.conversionProbability,
       ctaReadiness=excluded.ctaReadiness,
       intentMomentum=excluded.intentMomentum,
       updatedAt=excluded.updatedAt,
       lastInteraction=excluded.lastInteraction`,
      sessionId,
      merged.industry ?? null,
      merged.businessType ?? null,
      safeStringify(merged.goals),
      safeStringify(merged.servicesDiscussed),
      merged.leadScore ?? null,
      merged.stage ?? null,
      merged.budget ?? null,
      merged.timeline ?? null,
      merged.decisionMaker ?? null,
      merged.interestLevel ?? null,
      merged.lastUserProblem ?? null,
      safeStringify(merged.lastDetectedServices),
      merged.lastIntent ?? null,
      safeStringify(merged.bantSignals),
      merged.conversionProbability ?? null,
      merged.ctaReadiness ?? null,
      merged.intentMomentum ?? null,
      merged.updatedAt,
      merged.lastInteraction
    );
  }

  /* ---------- BOOKINGS ---------- */
  async storeBooking(data: {
    userId: string;
    serviceType?: string;
    preferredTime?: string;
    email?: string;
    calendlyLink?: string;
    status?: string;
  }) {
    const db = await this.db;

    await db.run(
      `INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      data.userId,
      data.serviceType ?? null,
      data.preferredTime ?? null,
      data.email ?? null,
      data.calendlyLink ?? null,
      data.status ?? "pending",
      new Date().toISOString()
    );
  }

  async updateBookingStatus(bookingId: string, status: string) {
    const db = await this.db;
    await db.run(`UPDATE bookings SET status=? WHERE id=?`, status, bookingId);
  }
}

/* ================= SINGLETON ================= */
export const memoryService = new MemoryService();
