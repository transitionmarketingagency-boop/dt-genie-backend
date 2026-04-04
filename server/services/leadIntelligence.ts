// server/services/leadIntelligence.ts

import { leadQualifier } from "./leadQualifier.js";
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
    if (text.includes(kw)) score += 1;
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
  memorySignals?: Partial<BANTSignals>
): BANTSignals {

  const msg = normalize(message);

  const signals: BANTSignals = {
    budget: memorySignals?.budget ?? 0,
    authority: memorySignals?.authority ?? 0,
    need: memorySignals?.need ?? 0,
    timeline: memorySignals?.timeline ?? 0,
  };

  const add = (value: number | undefined, increment: number) =>
    Math.min((value ?? 0) + increment, 1);

  /* ---------- NEED ---------- */
  const needHits = includesAny(msg, needSignals);
  if (needHits) signals.need = add(signals.need, 0.25 * needHits);

  /* ---------- BUDGET ---------- */
  const budgetHits = includesAny(msg, budgetSignals);
  if (budgetHits) signals.budget = add(signals.budget, 0.2 * budgetHits);

  /* ---------- AUTHORITY ---------- */
  const authorityHits = includesAny(msg, authoritySignals);
  if (authorityHits) signals.authority = add(signals.authority, 0.3 * authorityHits);

  /* ---------- TIMELINE ---------- */
  const timelineHits = includesAny(msg, timelineSignals);
  if (timelineHits) signals.timeline = add(signals.timeline, 0.2 * timelineHits);

  /* ---------- BUYING BOOST ---------- */
  if (includesAny(msg, buyingSignals)) {
    signals.need = add(signals.need, 0.4);
    signals.timeline = add(signals.timeline, 0.3);
  }

  return signals;
}

/* ================= HELPERS (TYPE FIXES) ================= */

// Convert authority score → string
function mapDecisionMaker(authority?: number): string | undefined {
  if (!authority) return undefined;
  return authority > 0.6 ? "yes" : undefined;
}

// Convert timeline score → string
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
): Promise<{ signals: BANTSignals; score: any } | null> {

  let memorySignals: Partial<BANTSignals> = {};

  /* ---------- LOAD MEMORY ---------- */
  if (sessionId) {
    try {
      const strategicMemory = await memoryService.getStrategicMemory(sessionId);

      if (strategicMemory) {
        memorySignals = {
          budget: Math.min(strategicMemory.budget ?? 0, 1),
          authority: strategicMemory.decisionMaker ? 0.8 : 0,
          need: strategicMemory.goals?.length ? 0.6 : 0,
          timeline: strategicMemory.timeline ? 0.6 : 0,
        };
      }
    } catch {
      memorySignals = {};
    }
  }

  /* ---------- DETECT ---------- */
  const signals = detectSignals(message, memorySignals);

  const hasSignal = Object.values(signals).some((v) => v && v > 0);

  if (!hasSignal) {
    return {
      signals,
      score: { total: 0, quality: "cold" },
    };
  }

  /* ---------- SCORE ---------- */
  const score = leadQualifier.scoreLead(sessionId, signals);

  /* ---------- SAVE MEMORY (FIXED TYPES) ---------- */
  if (sessionId) {
    try {
      await memoryService.updateStrategicMemory(sessionId, {
        budget: signals.budget,
        decisionMaker: mapDecisionMaker(signals.authority),
        goals: signals.need && signals.need > 0.5 ? ["growth"] : [],
        timeline: mapTimeline(signals.timeline),
      });
    } catch {
      // silent fail
    }
  }

  return { signals, score };
}
