import { leadQualifier } from "./leadQualifier.js";
import type { LeadScore } from "./leadQualifier.js";
import { memoryService } from "./memoryService.js";

/* ================= TYPES ================= */
export interface BANTSignals {
  budget?: number;
  authority?: number;
  need?: number;
  timeline?: number;
}

/* ================= NORMALIZE ================= */
function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(v: number | undefined): number {
  if (!v || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/* ================= MATCH ================= */
function includesAny(text: string, keywords: string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) hits++;
  }
  return hits;
}

/* ================= SIGNALS ================= */
const budgetSignals = ["budget","price","cost","investment","spend"];
const authoritySignals = ["i run","i am the owner","founder","ceo","my company"];
const needSignals = ["need","problem","low sales","no leads","bad results","not working"];
const timelineSignals = ["urgent","asap","soon","immediately","this month"];
const buyingSignals = ["hire","start","work with you","book","schedule"];

/* ================= DETECT ================= */
function detectSignals(
  message: string,
  memory: Partial<BANTSignals>
): BANTSignals {
  const msg = normalize(message);

  const signals: BANTSignals = {
    budget: clamp(memory.budget),
    authority: clamp(memory.authority),
    need: clamp(memory.need),
    timeline: clamp(memory.timeline),
  };

  const add = (v: number | undefined, inc: number) =>
    clamp((v ?? 0) + inc);

  signals.need = add(signals.need, 0.2 * includesAny(msg, needSignals));
  signals.budget = add(signals.budget, 0.15 * includesAny(msg, budgetSignals));
  signals.authority = add(signals.authority, 0.2 * includesAny(msg, authoritySignals));
  signals.timeline = add(signals.timeline, 0.15 * includesAny(msg, timelineSignals));

  if (includesAny(msg, buyingSignals) > 0) {
    signals.need = add(signals.need, 0.4);
    signals.timeline = add(signals.timeline, 0.3);
    signals.authority = add(signals.authority, 0.25);
  }

  return signals;
}

/* ================= MAIN ================= */
export async function analyzeLeadSignals(
  message: string,
  sessionId: string
): Promise<{ signals: BANTSignals; score: LeadScore }> {

  const cleanMsg = normalize(message);

  if (cleanMsg.length < 3) {
    return {
      signals: {},
      score: { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 },
    };
  }

  let memorySignals: Partial<BANTSignals> = {};

  try {
    const mem = await memoryService.getStrategicMemory(sessionId);

    memorySignals = {
      budget: clamp(mem?.budget),
      authority: mem?.decisionMaker ? 0.8 : 0,
      need: mem?.goals?.length ? 0.5 : 0,
      timeline: mem?.timeline ? 0.5 : 0,
    };
  } catch {}

  const signals = detectSignals(cleanMsg, memorySignals);

  let score: LeadScore;

  try {
    score = leadQualifier.scoreLead(sessionId, signals);
  } catch {
    score = { total: 0, budget: 0, authority: 0, need: 0, timeline: 0 };
  }

  /* ================= MEMORY UPDATE ================= */
  try {
    const mem = await memoryService.getStrategicMemory(sessionId);

    await memoryService.updateStrategicMemory(sessionId, {
      budget: signals.budget ?? mem.budget,
      timeline:
        signals.timeline && signals.timeline > 0.7
          ? "immediate"
          : mem.timeline,
      decisionMaker:
        signals.authority && signals.authority > 0.6
          ? "yes"
          : mem.decisionMaker,
    });
  } catch {}

  return { signals, score };
}
