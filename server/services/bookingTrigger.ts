// server/services/bookingTrigger.ts

import { StrategicMemory, memoryService } from "./memoryService.js";
import { BANTSignals } from "./leadIntelligence.js";

/* ================= TYPES ================= */
type Stage = "greeting" | "discovery" | "strategy" | "service" | "conversion";

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
  "hire", "book", "schedule", "call", "urgent",
  "as soon as possible", "immediately", "interested", "ready",
];

/* ================= DIRECT INTENT KEYWORDS ================= */
const STRONG_INTENT_KEYWORDS = [
  "i want to hire", "i want to work with you", "how do we start",
  "let's start", "ready to begin", "book a call", "schedule a call", "let's do this",
];

/* ================= REJECTION KEYWORDS ================= */
const REJECTION_KEYWORDS = [
  "not now", "later", "just exploring", "no thanks", "dont want", "don't want",
];

/* ================= BOOST SETTINGS ================= */
const MAX_CONTEXT_BOOST = 0.25;
const BOOST_PER_KEYWORD = 0.05;

/* ================= COOLDOWN ================= */
const BOOKING_COOLDOWN_MS = 1000 * 60 * 5; // 5 min
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
      const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex
      const regex = new RegExp(`\\b${safeKw}\\b`, "i");
      if (regex.test(lower)) matchedKeywords.add(kw);
    }
    keywordHits += matchedKeywords.size;
  }

  const boost = Math.min(keywordHits * BOOST_PER_KEYWORD, MAX_CONTEXT_BOOST);
  return Math.min(baseConfidence + boost, 1);
}

/* ================= BANT CONFIDENCE ================= */
function calculateBantConfidence(bant: Partial<BANTSignals>): number {
  const budget = bant.budget ?? 0;
  const authority = bant.authority ?? 0;
  const need = bant.need ?? 0;
  const timeline = bant.timeline ?? 0;

  const confidence =
    budget * BANT_WEIGHTS.budget +
    authority * BANT_WEIGHTS.authority +
    need * BANT_WEIGHTS.need +
    timeline * BANT_WEIGHTS.timeline;

  return Math.min(Math.max(confidence, 0), 1);
}

/* ================= COOLDOWN ================= */
function isInCooldown(sessionId: string): boolean {
  const last = bookingCooldownMap.get(sessionId);
  return last ? Date.now() - last < BOOKING_COOLDOWN_MS : false;
}

function markTriggered(sessionId: string) {
  bookingCooldownMap.set(sessionId, Date.now());
}

/* ================= MAIN TRIGGER LOGIC ================= */
export async function shouldTriggerBooking(
  sessionId: string,
  stage: Stage
): Promise<boolean> {
  try {
    /* ===== FETCH STRATEGIC MEMORY ===== */
    const memory:
      | (StrategicMemory & { bantSignals?: Partial<BANTSignals>; leadScore?: number })
      | undefined = await memoryService.getStrategicMemory(sessionId);

    const leadScore = memory?.leadScore ?? 0;
    const bant: Partial<BANTSignals> = memory?.bantSignals ?? {};

    /* ===== FETCH RECENT CONTEXT ===== */
    let recentMessages: string[] = [];
    try {
      const recentContext = await memoryService.getRecentContext(sessionId);
      recentMessages = recentContext?.map((m) => m.content) ?? [];
    } catch {}

    const latestMessage = recentMessages[recentMessages.length - 1] ?? "";

    /* ===== GUARD: VERY SHORT INPUT ===== */
    if (!latestMessage || latestMessage.length < 5) return false;

    /* ===== REJECTION GUARD ===== */
    if (containsKeyword(latestMessage, REJECTION_KEYWORDS)) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] User rejected booking`);
      }
      return false;
    }

    /* ===== COOLDOWN GUARD ===== */
    if (isInCooldown(sessionId)) {
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Trigger in cooldown`);
      }
      return false;
    }

    /* ===== HIGH INTENT OVERRIDE ===== */
    if (
      containsKeyword(latestMessage, STRONG_INTENT_KEYWORDS) &&
      latestMessage.length > 10
    ) {
      markTriggered(sessionId);
      if (process.env.DEBUG_MEMORY === "true") {
        console.log(`[BookingTrigger] Strong intent detected`);
      }
      return true;
    }

    /* ===== CALCULATE BANT CONFIDENCE + BOOST ===== */
    let bantConfidence = calculateBantConfidence(bant);
    bantConfidence = applyRecentContextBoost(recentMessages, bantConfidence);

    /* ===== DYNAMIC THRESHOLD ===== */
    let dynamicThreshold = SERVICE_STAGE_BASE_THRESHOLD;
    if (stage === "strategy") dynamicThreshold += 0.05;
    if (leadScore >= 0.8) dynamicThreshold -= 0.1;
    dynamicThreshold = Math.min(Math.max(dynamicThreshold, 0.3), 0.65);

    /* ===== DEBUG LOG ===== */
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

  } catch (err) {
    console.error("[BookingTrigger] Error:", err);
    return false;
  }
}
