// server/services/intentVectorFusion.ts

import { getTopChunks } from "../queryChunks.js";
import { detectIntent, Intent, intents } from "./intentManager.js";

/* ======================= TYPES ======================= */
export interface FusedChunk {
  text: string;
  source: string;
  fusionScore: number;
  intent: string;
}

type VectorChunk = {
  text: string;
  source: string;
  score: number;
  intent?: string;
};

/* ======================= CONFIG ======================= */
const VECTOR_WEIGHT = 0.65;
const INTENT_WEIGHT = 0.25;
const KEYWORD_WEIGHT = 0.1;

const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08;
const BOOKING_BOOST = 0.06;

const MAX_CHUNKS = 5;
const MIN_SCORE_THRESHOLD = 0.05;

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
  return text.split(/\s+/).filter(Boolean);
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
    if (!kw) continue;

    if (chunkText.includes(kw) && message.includes(kw)) {
      score += 0.03;
      if (score >= 0.12) break; // cap
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
    const key = (c.text || "").slice(0, 120);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/* ======================= MAIN FUSION ======================= */
async function getFusedChunksInternal(
  userMessage: string,
  baseTopN: number = MAX_CHUNKS
): Promise<FusedChunk[]> {
  const normalizedMessage = normalize(userMessage);
  if (normalizedMessage.length < 3) return [];

  const messageTokens = new Set(tokenize(normalizedMessage));

  /* ---------- VECTOR FETCH ---------- */
  let vectorChunks: VectorChunk[] = [];

  try {
    vectorChunks = await getTopChunks(userMessage, baseTopN + 5, 0.5);
  } catch (err) {
    console.error("Vector fetch failed:", err);
    return [];
  }

  if (!vectorChunks?.length) return [];

  vectorChunks = dedupeChunks(vectorChunks);

  /* ---------- INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    detectedIntents = detectIntent(userMessage, [], 5);
  } catch (err) {
    console.warn("Intent detection failed:", err);
  }

  const detectedIntentNames = detectedIntents.map((d) => d.intent.name);

  const detectedIntentScores = detectedIntents.reduce((acc, d) => {
    acc[d.intent.name] = d.score ?? 0.3;
    return acc;
  }, {} as Record<string, number>);

  /* ---------- INTENT KEYWORDS ---------- */
  const intentKeywordMap: Record<string, string[]> = {};

  for (const intentName of detectedIntentNames) {
    const foundIntent = intents.find((i) => i.name === intentName);

    intentKeywordMap[intentName] = (foundIntent?.keywords || [])
      .map((kw) => normalize(kw))
      .filter(Boolean);
  }

  /* ---------- FUSION SCORING ---------- */
  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text || "");
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = chunk.score ?? 0;
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    const intentBoost = detectedIntentNames.reduce((sum, intentName) => {
      if (chunk.intent === intentName) {
        return sum + (detectedIntentScores[intentName] || 0);
      }
      return sum;
    }, 0);

    const keywordIntentScore = detectedIntentNames.reduce((sum, intentName) => {
      const keywords = intentKeywordMap[intentName] || [];
      return sum + intentKeywordScore(normalizedMessage, chunkText, keywords);
    }, 0);

    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentBoost +
      KEYWORD_WEIGHT * keywordScore +
      keywordIntentScore +
      serviceBoost(chunkText) +
      pricingBoost(chunkText, normalizedMessage) +
      bookingBoost(chunkText, normalizedMessage);

    return {
      ...chunk,
      fusionScore: Number((fusionScore || 0).toFixed(4)),
    };
  });

  /* ---------- SORT & FILTER ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  const usedSources = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (!c.text) return false;
    if (c.fusionScore < MIN_SCORE_THRESHOLD) return false;
    if (usedSources.has(c.source)) return false;

    usedSources.add(c.source);
    return true;
  });

  /* ---------- FINAL OUTPUT ---------- */
  return finalChunks.slice(0, baseTopN).map((c) => ({
    text: c.text,
    source: c.source,
    fusionScore: c.fusionScore,
    intent: c.intent ?? "general",
  }));
}

/* ======================= EXPORT ======================= */
export const getFusedChunks = getFusedChunksInternal;
