// server/services/leadIntelligence.ts

import { leadQualifier, LeadScore } from "./leadQualifier.js";
import { memoryService } from "./memoryService.js";

/* ================= TYPES ================= */
export interface BANTSignals {
  budget?: number;     // 0-1
  authority?: number;  // 0-1
  need?: number;       // 0-1
  timeline?: number;   // 0-1
}

/* ================= NORMALIZATION ================= */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= FLEXIBLE MATCH ================= */
function includesAny(text: string, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i"); // word boundary check
    if (regex.test(text)) score += 1;
  }
  return score;
}

/* ================= SIGNAL KEYWORDS ================= */
const budgetSignals = [
  "budget", "cost", "pricing", "price", "how much",
  "investment", "spend", "ad spend", "we can spend"
];

const authoritySignals = [
  "i am the owner", "i'm the owner", "i run the company",
  "decision maker", "my company", "our company",
  "founder", "ceo"
];

const needSignals = [
  "we need", "we are struggling", "looking for", "need help",
  "want to improve", "need marketing", "need automation",
  "low roas", "no sales", "bad results", "not working",
  "conversion issue"
];

const timelineSignals = [
  "as soon as possible", "urgent", "this month",
  "next month", "immediately", "soon", "right away"
];

const buyingSignals = [
  "i want to start", "let's start", "ready to begin",
  "how do we proceed", "how do we start",
  "i want to work with you", "hire you",
  "start project"
];

/* ================= SIGNAL DETECTION ================= */
function detectSignals(
  message: string,
  memorySignals: Partial<BANTSignals> = {}
): BANTSignals {

  const msg = normalize(message);

  const signals: BANTSignals = {
    budget: memorySignals.budget ?? 0,
    authority: memorySignals.authority ?? 0,
    need: memorySignals.need ?? 0,
    timeline: memorySignals.timeline ?? 0,
  };

  const add = (value: number | undefined, increment: number) =>
    Math.min((value ?? 0) + increment, 1);

  /* ---------- NEED ---------- */
  signals.need = add(signals.need, 0.35 * includesAny(msg, needSignals));

  /* ---------- BUDGET ---------- */
  signals.budget = add(signals.budget, 0.25 * includesAny(msg, budgetSignals));

  /* ---------- AUTHORITY ---------- */
  signals.authority = add(signals.authority, 0.25 * includesAny(msg, authoritySignals));

  /* ---------- TIMELINE ---------- */
  signals.timeline = add(signals.timeline, 0.15 * includesAny(msg, timelineSignals));

  /* ---------- BUYING BOOST ---------- */
  const buyingHits = includesAny(msg, buyingSignals);
  if (buyingHits) {
    signals.need = add(signals.need, 0.4);
    signals.timeline = add(signals.timeline, 0.3);
  }

  return signals;
}

/* ================= HELPERS ================= */
function mapDecisionMaker(authority?: number): string | undefined {
  if (!authority) return undefined;
  return authority > 0.6 ? "yes" : undefined;
}

function mapTimeline(timeline?: number): string | undefined {
  if (!timeline) return undefined;
  if (timeline > 0.7) return "immediate";
  if (timeline > 0.4) return "soon";
  return "later";
}

/* ================= MAIN FUNCTION ================= */
export async function analyzeLeadSignals(
  message: string,
  sessionId: string
): Promise<{ signals: BANTSignals; score: LeadScore }> {

  let memorySignals: Partial<BANTSignals> = {};

  /* ---------- LOAD MEMORY ---------- */
  if (sessionId) {
    try {
      const mem = await memoryService.getStrategicMemory(sessionId);
      memorySignals = {
        budget: Math.min(mem.budget ?? 0, 1),
        authority: mem.decisionMaker ? 0.8 : 0,
        need: mem.goals?.length ? 0.6 : 0,
        timeline: mem.timeline ? 0.6 : 0,
      };
    } catch (err) {
      if (process.env.DEBUG_MEMORY === "true") console.warn("[Memory] Failed to load strategic memory:", err);
    }
  }

  /* ---------- DETECT ---------- */
  const signals = detectSignals(message, memorySignals);

  const hasSignal = Object.values(signals).some((v) => v && v > 0);

  if (!hasSignal) {
    return {
      signals,
      score: { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 },
    };
  }

  /* ---------- SCORE ---------- */
  const score = leadQualifier.scoreLead(sessionId, signals);

  /* ---------- SAVE MEMORY ---------- */
  if (sessionId) {
    try {
      await memoryService.updateStrategicMemory(sessionId, {
        budget: signals.budget,
        decisionMaker: mapDecisionMaker(signals.authority),
        goals: signals.need && signals.need > 0.5 ? ["growth"] : [],
        timeline: mapTimeline(signals.timeline),
      });
      if (process.env.DEBUG_MEMORY === "true") console.log(`[Memory] Updated strategic memory for session ${sessionId}`);
    } catch (err) {
      if (process.env.DEBUG_MEMORY === "true") console.warn(`[Memory] Failed to update strategic memory:`, err);
    }
  }

  return { signals, score };
}
