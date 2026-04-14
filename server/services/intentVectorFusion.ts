/* ===================== IMPORTS ===================== */
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
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ======================= TOKENIZE ======================= */
function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

/* ======================= OVERLAP ======================= */
function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;

  let hits = 0;
  for (const word of a) {
    if (b.has(word)) hits++;
  }

  return hits / Math.max(a.size, b.size);
}

/* ======================= INTENT KEYWORD SCORE ======================= */
function intentKeywordScore(
  message: string,
  chunkText: string,
  keywords: string[]
): number {
  const msgTokens = new Set(tokenize(message));
  const chunkTokens = new Set(tokenize(chunkText));

  let score = 0;

  for (const kw of keywords) {
    if (!kw) continue;

    const kwTokens = new Set(tokenize(kw));
    const overlap = keywordOverlap(msgTokens, kwTokens);

    score += overlap * 0.12;

    if (score >= 0.12) break;
  }

  return score;
}

/* ======================= BOOSTS ======================= */
function serviceBoost(chunkText: string): number {
  return normalize(chunkText).includes("service") ? SERVICE_BOOST : 0;
}

function pricingBoost(chunkText: string, message: string): number {
  if (!/(price|cost|pricing)/i.test(message)) return 0;
  return normalize(chunkText).includes("price") ? PRICING_BOOST : 0;
}

function bookingBoost(chunkText: string, message: string): number {
  if (!/(book|schedule|call)/i.test(message)) return 0;
  return normalize(chunkText).includes("book") ? BOOKING_BOOST : 0;
}

/* ======================= DEDUPE ======================= */
function dedupeChunks(chunks: VectorChunk[]): VectorChunk[] {
  const seen = new Set<string>();

  return chunks.filter((c) => {
    if (!c?.text) return false;

    const key = c.text.slice(0, 120).trim();
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/* ======================= MAIN FUSION ======================= */
export async function getFusedChunks(
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

  const intentNames = detectedIntents.map((d) => d.intent.name);

  const intentScores: Record<string, number> = {};
  for (const d of detectedIntents) {
    intentScores[d.intent.name] = d.score ?? 0.3;
  }

  const intentKeywordMap: Record<string, string[]> = {};

  for (const name of intentNames) {
    const found = intents.find((i) => i.name === name);

    intentKeywordMap[name] = (found?.keywords || [])
      .map(normalize)
      .filter(Boolean);
  }

  /* ---------- FUSION SCORING ---------- */
  const fused: FusedChunk[] = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text || "");
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = chunk.score ?? 0;
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    /* INTENT BOOST */
    const intentBoost = intentNames.reduce((sum, name) => {
      const keywords = intentKeywordMap[name] || [];

      for (const kw of keywords) {
        if (chunkTokens.has(kw)) {
          sum += intentScores[name] || 0;
          break;
        }
      }

      return sum;
    }, 0);

    /* INTENT TEXT SCORE */
    const keywordIntentScore = intentNames.reduce((sum, name) => {
      const keywords = intentKeywordMap[name] || [];
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
      text: chunk.text,
      source: chunk.source,
      intent: chunk.intent ?? "general",
      fusionScore: Number(fusionScore.toFixed(4)),
    };
  });

  /* ---------- SORT ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  /* ---------- FILTER ---------- */
  const usedSources = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (!c.text) return false;
    if (c.fusionScore < MIN_SCORE_THRESHOLD) return false;
    if (usedSources.has(c.source)) return false;

    usedSources.add(c.source);
    return true;
  });

  return finalChunks.slice(0, baseTopN);
}
