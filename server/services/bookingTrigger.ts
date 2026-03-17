// server/services/bookingTrigger.ts

import { StrategicMemory, memoryService } from "./memoryService.js";
import { BANTSignals } from "./leadIntelligence.js";

/* ================= TYPES ================= */

type Stage =
  | "greeting"
  | "discovery"
  | "strategy"
  | "service"
  | "conversion";

/* ================= THRESHOLDS ================= */

const LEAD_SCORE_THRESHOLD = 0.65;
const SERVICE_STAGE_BASE_THRESHOLD = 0.5;

/* ================= BANT WEIGHTS ================= */

const BANT_WEIGHTS = {
  budget: 0.2,
  authority: 0.3,
  need: 0.3,
  timeline: 0.2,
};

/* ================= CONTEXT KEYWORDS ================= */

const RECENT_CONTEXT_KEYWORDS = [
  "hire",
  "book",
  "schedule",
  "call",
  "urgent",
  "as soon as possible",
  "immediately",
  "interested",
  "ready",
];

/* ================= BOOST SETTINGS ================= */

const MAX_CONTEXT_BOOST = 0.25;   // Increased max boost
const BOOST_PER_KEYWORD = 0.05;   // Increased per keyword

/* ================= NORMALIZE ================= */

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/* ================= CONTEXT BOOST ================= */

function applyRecentContextBoost(
  recentMessages: string[],
  baseConfidence: number
): number {
  if (!recentMessages || recentMessages.length === 0) return baseConfidence;

  let keywordHits = 0;

  for (const msg of recentMessages) {
    const lower = normalize(msg);
    const matchedKeywords = new Set<string>();

    for (const kw of RECENT_CONTEXT_KEYWORDS) {
      const keyword = normalize(kw);
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(lower)) matchedKeywords.add(keyword);
    }

    keywordHits += matchedKeywords.size;
  }

  const boost = Math.min(keywordHits * BOOST_PER_KEYWORD, MAX_CONTEXT_BOOST);
  return Math.min(baseConfidence + boost, 1);
}

/* ================= BANT CONFIDENCE ================= */

function calculateBantConfidence(bant: Partial<BANTSignals>): number {
  const budgetSignal = bant.budget ?? 0;
  const authoritySignal = bant.authority ?? 0;
  const needSignal = bant.need ?? 0;
  const timelineSignal = bant.timeline ?? 0;

  const confidence =
    budgetSignal * BANT_WEIGHTS.budget +
    authoritySignal * BANT_WEIGHTS.authority +
    needSignal * BANT_WEIGHTS.need +
    timelineSignal * BANT_WEIGHTS.timeline;

  return Math.min(Math.max(confidence, 0), 1);
}

/* ================= TRIGGER LOGIC ================= */

export async function shouldTriggerBooking(
  sessionId: string,
  stage: Stage
): Promise<boolean> {
  try {
    /* ===== FETCH STRATEGIC MEMORY ===== */
    const memory:
      | (StrategicMemory & { bantSignals?: Partial<BANTSignals> })
      | undefined = await memoryService.getStrategicMemory(sessionId);

    const leadScore = memory?.leadScore ?? 0;
    const bant: Partial<BANTSignals> = memory?.bantSignals ?? {};

    /* ===== CALCULATE BANT CONFIDENCE ===== */
    let bantConfidence = calculateBantConfidence(bant);

    /* ===== FETCH RECENT CONTEXT ===== */
    let recentMessages: string[] = [];
    try {
      const recentContext = await memoryService.getRecentContext(sessionId);
      recentMessages = recentContext?.map((m) => m.content) ?? [];
    } catch {
      recentMessages = [];
    }

    /* ===== APPLY CONTEXT BOOST ===== */
    bantConfidence = applyRecentContextBoost(recentMessages, bantConfidence);

    /* ===== DYNAMIC THRESHOLD ===== */
    let dynamicThreshold = SERVICE_STAGE_BASE_THRESHOLD;

    if (stage === "strategy") dynamicThreshold += 0.05;  // Slightly lower than before
    if (leadScore >= 0.8) dynamicThreshold -= 0.1;

    dynamicThreshold = Math.min(Math.max(dynamicThreshold, 0.3), 0.65); // Cap threshold to avoid blocking borderline

    /* ===== DEBUG LOGGING ===== */
    if (process.env.DEBUG_MEMORY === "true") {
      console.log(
        `[BookingTrigger] session=${sessionId} stage=${stage} leadScore=${leadScore.toFixed(
          2
        )} bantConfidence=${bantConfidence.toFixed(
          2
        )} threshold=${dynamicThreshold.toFixed(2)}`
      );
    }

    /* ===== CONDITION 1: CONVERSION STAGE ===== */
    if (stage === "conversion" && leadScore >= LEAD_SCORE_THRESHOLD) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Conversion triggered`);
      }
      return true;
    }

    /* ===== CONDITION 2: SERVICE / STRATEGY STAGES ===== */
    if (
      (stage === "service" || stage === "strategy") &&
      leadScore >= 0.5 &&
      bantConfidence >= dynamicThreshold
    ) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Strategic trigger activated`);
      }
      return true;
    }

    /* ===== DEFAULT ===== */
    return false;
  } catch (error) {
    console.error("[BookingTrigger] Error:", error);
    return false;
  }
}
