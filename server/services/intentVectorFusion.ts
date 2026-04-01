// server/services/intentVectorFusion.ts

import { getTopChunks } from "../queryChunks.js";
import { detectIntent, Intent, intents } from "./intentManager.js";

/* ======================= TYPES ======================= */
type VectorChunk = {
  text: string;
  source: string;
  score: number;
  intent: string;
};

/* ======================= CONFIG ======================= */
const VECTOR_WEIGHT = 0.7;   // ⬆ prioritize vector (faster + reliable)
const INTENT_WEIGHT = 0.2;
const KEYWORD_WEIGHT = 0.1;

const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08;
const BOOKING_BOOST = 0.06;

const MAX_CHUNKS = 4; // ⬇ reduced for speed
const MIN_SCORE_THRESHOLD = 0.18;

/* ======================= FAST NORMALIZE ======================= */
function normalize(text: string): string {
  return text
    ?.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

/* ======================= TOKENIZE ======================= */
function tokenize(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

/* ======================= KEYWORD OVERLAP (FAST) ======================= */
function keywordOverlap(aTokens: Set<string>, bTokens: Set<string>) {
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const word of aTokens) {
    if (bTokens.has(word)) overlap++;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

/* ======================= PRECOMPUTE INTENT KEYWORDS ======================= */
const intentKeywordMap: string[] = intents
  .flatMap((i) => i.keywords || [])
  .map((k) => normalize(k))
  .filter(Boolean);

/* ======================= FAST INTENT KEYWORD SCORE ======================= */
function intentKeywordScore(message: string, chunkText: string) {
  let score = 0;

  for (let i = 0; i < intentKeywordMap.length; i++) {
    const kw = intentKeywordMap[i];
    if (chunkText.includes(kw) && message.includes(kw)) {
      score += 0.02;
      if (score >= 0.1) break; // ⬅ early exit
    }
  }

  return score;
}

/* ======================= BOOSTS ======================= */
function serviceBoost(chunkText: string) {
  return chunkText.includes("service") ? SERVICE_BOOST : 0;
}

function pricingBoost(chunkText: string, message: string) {
  if (!message.includes("price") && !message.includes("cost")) return 0;
  return chunkText.includes("price") ? PRICING_BOOST : 0;
}

function bookingBoost(chunkText: string, message: string) {
  if (!message.includes("book") && !message.includes("call")) return 0;
  return chunkText.includes("book") ? BOOKING_BOOST : 0;
}

/* ======================= MAIN ======================= */
async function getFusedChunksInternal(
  userMessage: string,
  baseTopN: number = 4
): Promise<{ text: string; source: string; fusionScore: number; intent: string }[]> {

  const normalizedMessage = normalize(userMessage);

  // 🚀 Early exit for weak queries
  if (normalizedMessage.length < 5) return [];

  const messageTokens = new Set(tokenize(normalizedMessage));

  /* ---------- VECTOR FETCH (OPTIMIZED) ---------- */
  const vectorChunks: VectorChunk[] = await getTopChunks(userMessage, baseTopN + 2, 0.55);
  if (!vectorChunks?.length) return [];

  /* ---------- INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    const detected = detectIntent(userMessage, 2); // ⬇ reduced
    if (Array.isArray(detected)) detectedIntents = detected;
  } catch {
    detectedIntents = [];
  }

  const primaryIntent = detectedIntents[0]?.intent?.name ?? "general";
  const intentScore = detectedIntents[0]?.score ?? 0.2;

  /* ---------- FUSION ---------- */
  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text || "");
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = chunk.score || 0;

    const keywordScore = keywordOverlap(messageTokens, chunkTokens);
    const intentBoost = chunk.intent === primaryIntent ? intentScore : 0.1;

    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentBoost +
      KEYWORD_WEIGHT * keywordScore +
      intentKeywordScore(normalizedMessage, chunkText) +
      serviceBoost(chunkText) +
      pricingBoost(chunkText, normalizedMessage) +
      bookingBoost(chunkText, normalizedMessage);

    return {
      ...chunk,
      fusionScore,
    };
  });

  /* ---------- SORT + FILTER ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  const finalChunks = fused
    .filter((c) => c.fusionScore >= MIN_SCORE_THRESHOLD)
    .slice(0, baseTopN);

  return finalChunks.map((c) => ({
    text: c.text,
    source: c.source,
    fusionScore: Number(c.fusionScore.toFixed(4)),
    intent: c.intent ?? "general",
  }));
}

/* ======================= EXPORT ======================= */
export { getFusedChunksInternal as getFusedChunks };
