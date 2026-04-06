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
const VECTOR_WEIGHT = 0.7;
const INTENT_WEIGHT = 0.2;
const KEYWORD_WEIGHT = 0.1;

const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08;
const BOOKING_BOOST = 0.06;

const MAX_CHUNKS = 4;
const MIN_SCORE_THRESHOLD = 0.2;

/* ======================= NORMALIZE ======================= */
function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ======================= TOKENIZE ======================= */
function tokenize(text: string): string[] {
  return text.split(" ").filter(Boolean);
}

/* ======================= KEYWORD OVERLAP ======================= */
function keywordOverlap(aTokens: Set<string>, bTokens: Set<string>) {
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;

  for (const word of aTokens) {
    if (bTokens.has(word)) overlap++;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

/* ======================= INTENT KEYWORD SCORE ======================= */
function intentKeywordScore(
  message: string,
  chunkText: string,
  relevantKeywords: string[]
) {
  let score = 0;

  for (const kw of relevantKeywords) {
    if (chunkText.includes(kw) && message.includes(kw)) {
      score += 0.03;
      if (score >= 0.12) break;
    }
  }

  return score;
}

/* ======================= BOOSTS ======================= */
function serviceBoost(chunkText: string) {
  return chunkText.includes("service") ? SERVICE_BOOST : 0;
}

function pricingBoost(chunkText: string, message: string) {
  if (!/(price|cost|pricing)/i.test(message)) return 0;
  return chunkText.includes("price") ? PRICING_BOOST : 0;
}

function bookingBoost(chunkText: string, message: string) {
  if (!/(book|schedule|call)/i.test(message)) return 0;
  return chunkText.includes("book") ? BOOKING_BOOST : 0;
}

/* ======================= DEDUPE ======================= */
function dedupeChunks(chunks: VectorChunk[]) {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.text.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ======================= MAIN ======================= */
async function getFusedChunksInternal(
  userMessage: string,
  baseTopN: number = 4
): Promise<{ text: string; source: string; fusionScore: number; intent: string }[]> {

  const normalizedMessage = normalize(userMessage);

  // 🚀 smarter early exit
  if (normalizedMessage.length < 3) return [];

  const messageTokens = new Set(tokenize(normalizedMessage));

  /* ---------- VECTOR FETCH ---------- */
  let vectorChunks: VectorChunk[] = [];

  try {
    vectorChunks = await getTopChunks(userMessage, baseTopN + 3, 0.5);
  } catch {
    return [];
  }

  if (!vectorChunks?.length) return [];

  vectorChunks = dedupeChunks(vectorChunks);

  /* ---------- INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    const detected = detectIntent(userMessage, 2);
    if (Array.isArray(detected)) detectedIntents = detected;
  } catch {}

  const primaryIntent = detectedIntents[0]?.intent?.name ?? "general";
  const intentScore = detectedIntents[0]?.score ?? 0.3;

  /* ---------- RELEVANT KEYWORDS ONLY ---------- */
  const relevantKeywords =
    intents
      .find((i) => i.name === primaryIntent)
      ?.keywords?.map((k) => normalize(k)) || [];

  /* ---------- FUSION ---------- */
  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text || "");
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = chunk.score || 0;

    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    // ✅ FIXED: only boost if matches intent
    const intentBoost =
      chunk.intent === primaryIntent ? intentScore : 0;

    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentBoost +
      KEYWORD_WEIGHT * keywordScore +
      intentKeywordScore(normalizedMessage, chunkText, relevantKeywords) +
      serviceBoost(chunkText) +
      pricingBoost(chunkText, normalizedMessage) +
      bookingBoost(chunkText, normalizedMessage);

    return {
      ...chunk,
      fusionScore,
    };
  });

  /* ---------- SORT ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  /* ---------- DIVERSITY CONTROL ---------- */
  const usedSources = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (c.fusionScore < MIN_SCORE_THRESHOLD) return false;

    // limit same source repetition
    if (usedSources.has(c.source)) return false;

    usedSources.add(c.source);
    return true;
  });

  return finalChunks.slice(0, baseTopN).map((c) => ({
    text: c.text,
    source: c.source,
    fusionScore: Number(c.fusionScore.toFixed(4)),
    intent: c.intent ?? "general",
  }));
}

/* ======================= EXPORT ======================= */
export { getFusedChunksInternal as getFusedChunks };
