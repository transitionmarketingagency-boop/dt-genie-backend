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

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/* ================= SIGNAL DETECTION ================= */

function detectSignals(message: string, memorySignals?: Partial<BANTSignals>): BANTSignals {
  const msg = normalize(message);
  const signals: BANTSignals = { ...memorySignals };

  // Utility to add weighted signals
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

export async function analyzeLeadSignals(message: string, sessionId: string) {
  let memorySignals: Partial<BANTSignals> = {};

  // Include prior memory to boost detection
  if (sessionId) {
    const strategicMemory = await memoryService.getStrategicMemory(sessionId);

    if (strategicMemory?.budget)
      memorySignals.budget = Math.min(strategicMemory.budget / 1000, 1);

    if (strategicMemory?.decisionMaker)
      memorySignals.authority = 0.8;

    if (strategicMemory?.goals?.length)
      memorySignals.need = 0.7;

    if (strategicMemory?.timeline)
      memorySignals.timeline = 0.6;
  }

  const signals = detectSignals(message, memorySignals);

  if (!Object.keys(signals).length) return null;

  // Score lead in leadQualifier system
  const score = leadQualifier.scoreLead(sessionId, signals);

  return { signals, score };
}
