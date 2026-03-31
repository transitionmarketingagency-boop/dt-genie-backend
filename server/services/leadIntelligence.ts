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

/* ================= KEYWORD MAP ================= */
const budgetSignals = [
  "budget",
  "cost",
  "pricing",
  "price",
  "how much",
  "investment",
];

const authoritySignals = [
  "i am the owner",
  "i'm the owner",
  "i run the company",
  "decision maker",
  "my company",
  "our company",
];

const needSignals = [
  "we need",
  "we are struggling",
  "looking for",
  "need help",
  "want to improve",
  "need marketing",
  "need automation",
];

const timelineSignals = [
  "as soon as possible",
  "urgent",
  "this month",
  "next month",
  "immediately",
  "soon",
];

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/* ================= SIGNAL DETECTION ================= */
function detectSignals(message: string, memorySignals?: Partial<BANTSignals>): BANTSignals {
  const msg = normalize(message);
  const signals: BANTSignals = { ...memorySignals };

  // Utility: add weighted signals, capped at 1
  const addSignal = (keywords: string[], key: keyof BANTSignals, weight: number) => {
    const hits = keywords.filter((kw) => msg.includes(kw)).length;
    if (hits) {
      signals[key] = Math.min((signals[key] ?? 0) + hits * weight, 1);
    }
  };

  addSignal(budgetSignals, "budget", 0.2);
  addSignal(authoritySignals, "authority", 0.25);
  addSignal(needSignals, "need", 0.3);
  addSignal(timelineSignals, "timeline", 0.2);

  return signals;
}

/* ================= MAIN FUNCTION ================= */
export async function analyzeLeadSignals(
  message: string,
  sessionId: string
): Promise<{ signals: BANTSignals; score: any } | null> {
  let memorySignals: Partial<BANTSignals> = {};

  // Include prior strategic memory to boost detection
  if (sessionId) {
    const strategicMemory = await memoryService.getStrategicMemory(sessionId);

    if (strategicMemory) {
      // Normalize and clamp prior memory signals
      memorySignals.budget = Math.min(strategicMemory.budget ?? 0, 1);
      memorySignals.authority = strategicMemory.decisionMaker ? 0.8 : 0;
      memorySignals.need = strategicMemory.goals?.length ? 0.7 : 0;
      memorySignals.timeline = strategicMemory.timeline ? 0.6 : 0;
    }
  }

  const signals = detectSignals(message, memorySignals);

  // Return null if no signals detected
  if (!Object.values(signals).some((v) => v && v > 0)) return null;

  // Score lead in leadQualifier system
  const score = leadQualifier.scoreLead(sessionId, signals);

  return { signals, score };
}
