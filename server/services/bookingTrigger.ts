// server/services/bookingTrigger.ts

import { StrategicMemory, memoryService } from "./memoryService.js";
import { BANTSignals } from "./leadIntelligence.js";

/* ================= THRESHOLDS ================= */

const LEAD_SCORE_THRESHOLD = 0.65; // conversion stage
const SERVICE_STAGE_BASE_THRESHOLD = 0.5; // base threshold for service/strategy stages

/* ================= BANT WEIGHTS ================= */

const BANT_WEIGHTS = {
  budget: 0.2,
  authority: 0.3,
  need: 0.3,
  timeline: 0.2,
};

/* ================= RECENT CONTEXT BOOST ================= */

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

// Prevent artificial keyword inflation
const MAX_CONTEXT_BOOST = 0.15;
const BOOST_PER_KEYWORD = 0.03;

/**
 * Boost BANT confidence based on recent messages
 * Prevents repeated keyword abuse
 */
function applyRecentContextBoost(
  recentMessages: string[],
  baseConfidence: number
): number {

  let keywordHits = 0;

  for (const msg of recentMessages) {

    const lower = msg.toLowerCase();

    // Track unique keyword matches per message
    const matchedKeywords = new Set<string>();

    for (const kw of RECENT_CONTEXT_KEYWORDS) {
      if (lower.includes(kw)) {
        matchedKeywords.add(kw);
      }
    }

    keywordHits += matchedKeywords.size;
  }

  const boost = Math.min(keywordHits * BOOST_PER_KEYWORD, MAX_CONTEXT_BOOST);

  return Math.min(baseConfidence + boost, 1);
}

/* ================= TRIGGER LOGIC ================= */

export async function shouldTriggerBooking(
  sessionId: string,
  stage: string
): Promise<boolean> {

  try {

    /* ===== FETCH MEMORY ===== */

    const memory: StrategicMemory & { bantSignals?: Partial<BANTSignals> } =
      await memoryService.getStrategicMemory(sessionId);

    const leadScore = memory?.leadScore ?? 0;

    /* ===== BANT SIGNALS ===== */

    const bant: Partial<BANTSignals> = memory?.bantSignals ?? {};

    const budgetSignal = bant.budget ?? 0;
    const authoritySignal = bant.authority ?? 0;
    const needSignal = bant.need ?? 0;
    const timelineSignal = bant.timeline ?? 0;

    /* ===== WEIGHTED BANT CONFIDENCE ===== */

    let bantConfidence =
      budgetSignal * BANT_WEIGHTS.budget +
      authoritySignal * BANT_WEIGHTS.authority +
      needSignal * BANT_WEIGHTS.need +
      timelineSignal * BANT_WEIGHTS.timeline;

    /* ===== APPLY CONTEXT BOOST ===== */

    const recentContext = await memoryService.getRecentContext(sessionId);
    const recentMessages = recentContext?.map(m => m.content) ?? [];

    bantConfidence = applyRecentContextBoost(recentMessages, bantConfidence);

    /* ===== DYNAMIC THRESHOLD ===== */

    let dynamicThreshold = SERVICE_STAGE_BASE_THRESHOLD;

    if (stage === "strategy") {
      dynamicThreshold += 0.1;
    }

    if (leadScore >= 0.8) {
      dynamicThreshold -= 0.1;
    }

    dynamicThreshold = Math.min(Math.max(dynamicThreshold, 0.3), 0.7);

    /* ===== TRIGGER CONDITIONS ===== */

    // 1️⃣ Conversion stage
    if (stage === "conversion" && leadScore >= LEAD_SCORE_THRESHOLD) {

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(
          `[BookingTrigger] Conversion stage triggered | session=${sessionId} leadScore=${leadScore.toFixed(2)}`
        );
      }

      return true;
    }

    // 2️⃣ Service / Strategy stage
    if (
      (stage === "service" || stage === "strategy") &&
      leadScore >= 0.5 &&
      bantConfidence >= dynamicThreshold
    ) {

      if (process.env.DEBUG_MEMORY === "true") {
        console.log(
          `[BookingTrigger] Stage "${stage}" triggered | session=${sessionId} leadScore=${leadScore.toFixed(
            2
          )} bantConfidence=${bantConfidence.toFixed(
            2
          )} threshold=${dynamicThreshold.toFixed(2)}`
        );
      }

      return true;
    }

    /* ===== DEFAULT ===== */

    return false;

  } catch (error) {

    console.error("[BookingTrigger] Error:", error);

    // Never trigger booking if system fails
    return false;
  }
}
