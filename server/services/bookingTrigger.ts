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

/* ================= DIRECT INTENT KEYWORDS ================= */

const STRONG_INTENT_KEYWORDS = [
  "i want to hire",
  "i want to work with you",
  "how do we start",
  "let's start",
  "ready to begin",
  "book a call",
  "schedule a call",
  "let's do this",
];

/* ================= REJECTION KEYWORDS ================= */

const REJECTION_KEYWORDS = [
  "not now",
  "later",
  "just exploring",
  "no thanks",
  "dont want",
  "don't want",
];

/* ================= BOOST SETTINGS ================= */

const MAX_CONTEXT_BOOST = 0.25;
const BOOST_PER_KEYWORD = 0.05;

/* ================= COOLDOWN ================= */

const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 minutes
const bookingCooldownMap = new Map<string, number>();

/* ================= NORMALIZE ================= */

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/* ================= KEYWORD CHECK ================= */

function containsKeyword(text: string, keywords: string[]): boolean {
  const msg = normalize(text);
  return keywords.some((kw) => msg.includes(kw));
}

/* ================= CONTEXT BOOST ================= */

function applyRecentContextBoost(
  recentMessages: string[],
  baseConfidence: number
): number {
  if (!recentMessages?.length) return baseConfidence;

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

/* ================= COOLDOWN CHECK ================= */

function isInCooldown(sessionId: string): boolean {
  const lastTrigger = bookingCooldownMap.get(sessionId);
  if (!lastTrigger) return false;
  return Date.now() - lastTrigger < BOOKING_COOLDOWN_MS;
}

function markTriggered(sessionId: string) {
  bookingCooldownMap.set(sessionId, Date.now());
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

    /* ===== FETCH RECENT CONTEXT ===== */

    let recentMessages: string[] = [];

    try {
      const recentContext = await memoryService.getRecentContext(sessionId);
      recentMessages = recentContext?.map((m) => m.content) ?? [];
    } catch {
      recentMessages = [];
    }

    const latestMessage = recentMessages[recentMessages.length - 1] || "";

    /* ===== REJECTION GUARD ===== */

    if (containsKeyword(latestMessage, REJECTION_KEYWORDS)) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Rejected by user`);
      }
      return false;
    }

    /* ===== COOLDOWN GUARD ===== */

    if (isInCooldown(sessionId)) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] In cooldown`);
      }
      return false;
    }

    /* ===== STRONG INTENT OVERRIDE ===== */

    if (containsKeyword(latestMessage, STRONG_INTENT_KEYWORDS)) {
      markTriggered(sessionId);
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Strong intent override`);
      }
      return true;
    }

    /* ===== CALCULATE BANT CONFIDENCE ===== */

    let bantConfidence = calculateBantConfidence(bant);

    /* ===== APPLY CONTEXT BOOST ===== */

    bantConfidence = applyRecentContextBoost(recentMessages, bantConfidence);

    /* ===== DYNAMIC THRESHOLD ===== */

    let dynamicThreshold = SERVICE_STAGE_BASE_THRESHOLD;

    if (stage === "strategy") dynamicThreshold += 0.05;
    if (leadScore >= 0.8) dynamicThreshold -= 0.1;

    dynamicThreshold = Math.min(Math.max(dynamicThreshold, 0.3), 0.65);

    /* ===== DEBUG ===== */

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
      markTriggered(sessionId);
      return true;
    }

    /* ===== CONDITION 2: SERVICE/STRATEGY STAGE ===== */

    if (
      (stage === "service" || stage === "strategy") &&
      leadScore >= 0.5 &&
      bantConfidence >= dynamicThreshold
    ) {
      markTriggered(sessionId);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[BookingTrigger] Error:", error);
    return false;
  }
}
