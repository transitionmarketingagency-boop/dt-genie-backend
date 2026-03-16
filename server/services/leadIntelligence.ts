// server/services/leadIntelligence.ts

import { leadQualifier } from "./leadQualifier.js";
import { memoryService } from "./memoryService.js";

/* ================= TYPES ================= */

export interface BANTSignals {
  budget?: number;
  authority?: number;
  need?: number;
  timeline?: number;
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

function normalize(text: string) {
  return text.toLowerCase().trim();
}

/* ================= SIGNAL DETECTION ================= */

function detectSignals(message: string, memorySignals?: Partial<BANTSignals>): BANTSignals {

  const msg = normalize(message);              
  const signals: BANTSignals = { ...memorySignals };

  // Budget
  const budgetHits = budgetSignals.filter((kw) => msg.includes(kw)).length;
  if (budgetHits) signals.budget = Math.min((signals.budget ?? 0) + 0.2 * budgetHits, 1);

  // Authority
  const authorityHits = authoritySignals.filter((kw) => msg.includes(kw)).length;
  if (authorityHits) signals.authority = Math.min((signals.authority ?? 0) + 0.25 * authorityHits, 1);

  // Need
  const needHits = needSignals.filter((kw) => msg.includes(kw)).length;
  if (needHits) signals.need = Math.min((signals.need ?? 0) + 0.3 * needHits, 1);

  // Timeline
  const timelineHits = timelineSignals.filter((kw) => msg.includes(kw)).length;
  if (timelineHits) signals.timeline = Math.min((signals.timeline ?? 0) + 0.2 * timelineHits, 1);

  return signals;
}

/* ================= MAIN FUNCTION ================= */

export async function analyzeLeadSignals(
  message: string,
  sessionId: string
) {

  let memorySignals: Partial<BANTSignals> = {};

  // Include prior memory to boost detection
  if (sessionId) {
    const strategicMemory = await memoryService.getStrategicMemory(sessionId);

    if (strategicMemory?.budget) memorySignals.budget = Math.min(strategicMemory.budget / 1000, 1);
    if (strategicMemory?.decisionMaker) memorySignals.authority = 0.8;
    if (strategicMemory?.goals?.length) memorySignals.need = 0.7;
    if (strategicMemory?.timeline) memorySignals.timeline = 0.6;
  }

  const signals = detectSignals(message, memorySignals);

  if (Object.keys(signals).length === 0) return null;

  // Score lead in leadQualifier system
  const score = leadQualifier.scoreLead(sessionId, signals);

  return { signals, score };
}
