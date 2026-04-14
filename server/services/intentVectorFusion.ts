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
const VECTOR_WEIGHT = 0.72;
const INTENT_WEIGHT = 0.18;
const KEYWORD_WEIGHT = 0.10;

const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08;
const BOOKING_BOOST = 0.06;

const MAX_CHUNKS = 5;
const MIN_SCORE_THRESHOLD = 0.03; // FIX: slightly lower for better recall

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

  return hits / Math.max(a.size, 1);
}

/* ======================= INTENT SCORE ======================= */
function calculateIntentKeywordScore(
  message: string,
  chunkText: string,
  keywords: string[]
): number {
  if (!keywords?.length) return 0;

  const msgTokens = new Set(tokenize(message));
  const chunkTokens = new Set(tokenize(chunkText));

  let score = 0;

  for (const kw of keywords) {
    const kwTokens = new Set(tokenize(kw));
    const overlap = keywordOverlap(msgTokens, kwTokens);

    score += overlap * 0.1;

    if (score > 0.2) break; // FIX: tighter cap
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
  if (!/(book|schedule|call|meeting)/i.test(message)) return 0;
  return normalize(chunkText).includes("book") ? BOOKING_BOOST : 0;
}

/* ======================= DEDUPE ======================= */
function dedupeChunks(chunks: VectorChunk[]): VectorChunk[] {
  const seen = new Set<string>();

  return chunks.filter((c) => {
    if (!c?.text) return false;

    const key = normalize(c.text).slice(0, 120);
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
    vectorChunks = await getTopChunks(userMessage, baseTopN + 6, 0.45);
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
    intentScores[d.intent.name] = d.score ?? 0.2;
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

    const rawText = chunk.text || "";
    const chunkText = normalize(rawText);
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = Math.min(chunk.score ?? 0, 1);
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    /* INTENT BOOST */
    let intentBoost = 0;

    for (const name of intentNames) {
      const keywords = intentKeywordMap[name] || [];

      const match = keywords.some((kw) => chunkTokens.has(kw));
      if (match) {
        intentBoost += intentScores[name] ?? 0.15;
      }
    }

    /* INTENT TEXT SCORE */
    let intentTextScore = 0;

    for (const name of intentNames) {
      const keywords = intentKeywordMap[name] || [];

      intentTextScore += calculateIntentKeywordScore(
        normalizedMessage,
        chunkText,
        keywords
      );
    }

    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentBoost +
      KEYWORD_WEIGHT * keywordScore +
      intentTextScore +
      serviceBoost(chunkText) +
      pricingBoost(chunkText, normalizedMessage) +
      bookingBoost(chunkText, normalizedMessage);

    return {
      text: rawText,
      source: chunk.source,
      intent: chunk.intent ?? "general",
      fusionScore: Number(fusionScore.toFixed(4)),
    };
  });

  /* ---------- SORT ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  /* ---------- FILTER ---------- */
  const used = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (!c.text) return false;
    if (c.fusionScore < MIN_SCORE_THRESHOLD) return false;

    const key = normalize(c.text).slice(0, 120);
    if (used.has(key)) return false;

    used.add(key);
    return true;
  });

  return finalChunks.slice(0, baseTopN);
}
