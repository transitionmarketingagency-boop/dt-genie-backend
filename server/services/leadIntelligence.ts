import { leadQualifier } from "./leadQualifier.js";
import type { LeadScore } from "./leadQualifier.js";
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
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= SAFE CLAMP ================= */
function clamp(value: number | undefined): number {
  if (value === undefined || value === null || isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/* ================= FLEXIBLE MATCH (FIXED) ================= */
function includesAny(text: string, keywords: string[]): number {
  let score = 0;

  for (const kw of keywords) {
    // 🔥 phrase + partial match support
    if (text.includes(kw)) {
      score += 1;
    }
  }

  return score;
}

/* ================= SIGNAL KEYWORDS ================= */
const budgetSignals = ["budget","cost","pricing","price","how much","investment","spend","ad spend","we can spend"];
const authoritySignals = ["i am the owner","i'm the owner","i run","decision maker","my company","our company","founder","ceo"];
const needSignals = ["we need","struggling","looking for","need help","want to improve","need marketing","automation","low roas","no sales","bad results","not working","conversion issue"];
const timelineSignals = ["as soon as possible","urgent","this month","next month","immediately","soon","right away"];
const buyingSignals = [
  "i want to start",
  "let's start",
  "ready to begin",
  "how do we proceed",
  "how do we start",
  "i want to work with you",
  "hire you",
  "start project",
  "help me scale",
  "fix this for me",
  "can you do this",
];

/* ================= SIGNAL DETECTION ================= */
function detectSignals(message: string, memorySignals: Partial<BANTSignals> = {}): BANTSignals {
  const msg = normalize(message);

  const signals: BANTSignals = {
    budget: clamp(memorySignals.budget),
    authority: clamp(memorySignals.authority),
    need: clamp(memorySignals.need),
    timeline: clamp(memorySignals.timeline),
  };

  const add = (value: number | undefined, increment: number) =>
    clamp((value ?? 0) + increment);

  // ----- NEED -----
  signals.need = add(signals.need, 0.25 * includesAny(msg, needSignals));

  // ----- BUDGET -----
  signals.budget = add(signals.budget, 0.2 * includesAny(msg, budgetSignals));

  // ----- AUTHORITY -----
  signals.authority = add(signals.authority, 0.25 * includesAny(msg, authoritySignals));

  // ----- TIMELINE -----
  signals.timeline = add(signals.timeline, 0.2 * includesAny(msg, timelineSignals));

  // ----- BUYING INTENT BOOST (UPGRADED) -----
  const buyingHits = includesAny(msg, buyingSignals);
  if (buyingHits > 0) {
    signals.need = add(signals.need, 0.5);
    signals.timeline = add(signals.timeline, 0.4);
    signals.authority = add(signals.authority, 0.3);
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

  const cleanMsg = normalize(message);

  // 🔥 IGNORE LOW VALUE INPUTS
  if (cleanMsg.length < 3) {
    return {
      signals: {},
      score: { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 },
    };
  }

  let memorySignals: Partial<BANTSignals> = {};

  /* ================= LOAD MEMORY ================= */
  if (sessionId) {
    try {
      const mem = await memoryService.getStrategicMemory(sessionId);

      memorySignals = {
        budget: clamp(mem?.budget),
        authority: mem?.decisionMaker ? 0.8 : 0,
        need: Array.isArray(mem?.goals) && mem.goals.length ? 0.5 : 0,
        timeline: mem?.timeline ? 0.5 : 0,
      };

    } catch (err) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.warn("[Memory] Failed to load strategic memory:", err);
      }
    }
  }

  /* ================= DETECT SIGNALS ================= */
  const signals = detectSignals(cleanMsg, memorySignals);

  const hasSignal = Object.values(signals).some((v) => v && v > 0);

  if (!hasSignal) {
    return {
      signals,
      score: { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 },
    };
  }

  /* ================= SCORE ================= */
  let score: LeadScore;

  try {
    score = leadQualifier.scoreLead(sessionId, signals);
  } catch (err) {
    console.error("[LeadQualifier] scoreLead failed:", err);
    score = { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 };
  }

  /* ================= SAVE MEMORY (SAFE MERGE) ================= */
  if (sessionId) {
    try {
      const mem = await memoryService.getStrategicMemory(sessionId);

      await memoryService.updateStrategicMemory(sessionId, {
        budget: signals.budget ?? mem.budget,
        decisionMaker: mapDecisionMaker(signals.authority) ?? mem.decisionMaker,
        timeline: mapTimeline(signals.timeline) ?? mem.timeline,
        goals:
          signals.need && signals.need > 0.5
            ? [...new Set([...(mem.goals || []), "growth"])]
            : mem.goals,
      });

    } catch (err) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.warn("[Memory] Failed to update strategic memory:", err);
      }
    }
  }

  return { signals, score };
}
