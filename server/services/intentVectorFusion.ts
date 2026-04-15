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
const INTENT_WEIGHT = 0.22; // upgraded (Phase 2)
const KEYWORD_WEIGHT = 0.12; // upgraded (Phase 2)

const SERVICE_BOOST = 0.06;
const PRICING_BOOST = 0.10;
const BOOKING_BOOST = 0.09;

/* ======================= HELPERS ======================= */

function normalize(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;

  let hits = 0;
  for (const word of a) {
    if (b.has(word)) hits++;
  }

  return hits / Math.max(a.size, 1);
}

/* ======================= DYNAMIC THRESHOLD (PHASE 2 CORE FIX) ======================= */
function dynamicThreshold(message: string): number {
  const msg = message.toLowerCase();

  let base = 0.30;

  if (/(price|cost|pricing)/.test(msg)) base -= 0.08;
  if (/(book|call|meeting|schedule)/.test(msg)) base -= 0.07;
  if (/(service|agency|offer)/.test(msg)) base -= 0.05;

  return Math.max(0.22, Math.min(0.45, base));
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

    score += overlap * 0.12;

    if (score > 0.25) break;
  }

  return score;
}

/* ======================= BOOST SYSTEM ======================= */

function serviceBoost(text: string): number {
  return /service|agency|solution/i.test(text) ? SERVICE_BOOST : 0;
}

function pricingBoost(text: string, message: string): number {
  if (!/(price|cost|pricing|package)/i.test(message)) return 0;
  return /price|cost|pricing/i.test(text) ? PRICING_BOOST : 0;
}

function bookingBoost(text: string, message: string): number {
  if (!/(book|schedule|call|meeting|consultation)/i.test(message)) return 0;
  return /book|schedule|call/i.test(text) ? BOOKING_BOOST : 0;
}

/* ======================= CHUNK QUALITY FILTER (PHASE 2 FIX) ======================= */
function isValidChunk(text: string): boolean {
  if (!text) return false;

  const clean = normalize(text);

  if (clean.length < 20) return false; // removes noise
  if (clean.split(" ").length < 5) return false;

  // remove junk/system-like chunks
  if (/undefined|null|error|loading/i.test(clean)) return false;

  return true;
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
  baseTopN: number = 5
): Promise<FusedChunk[]> {

  const normalizedMessage = normalize(userMessage);
  if (normalizedMessage.length < 3) return [];

  const messageTokens = new Set(tokenize(normalizedMessage));

  /* ---------- VECTOR FETCH ---------- */
  let vectorChunks: VectorChunk[] = [];

  try {
    vectorChunks = await getTopChunks(userMessage, baseTopN + 8, 0.45);
  } catch (err) {
    console.error("Vector fetch failed:", err);
    return [];
  }

  if (!vectorChunks?.length) return [];

  /* ---------- CLEAN CHUNKS (PHASE 2 FIX) ---------- */
  vectorChunks = dedupeChunks(vectorChunks).filter((c) =>
    isValidChunk(c.text)
  );

  /* ---------- INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    detectedIntents = detectIntent(userMessage, [], 5);
  } catch {}

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
  const threshold = dynamicThreshold(userMessage);

  const fused: FusedChunk[] = vectorChunks.map((chunk) => {

    const rawText = chunk.text;
    const chunkText = normalize(rawText);
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = Math.min(chunk.score ?? 0, 1);
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    /* INTENT BOOST */
    let intentBoost = 0;

    for (const name of intentNames) {
      const keywords = intentKeywordMap[name] || [];
      const match = keywords.some((kw) => chunkTokens.has(kw));
      if (match) intentBoost += intentScores[name] ?? 0.15;
    }

    /* INTENT TEXT SCORE */
    let intentTextScore = 0;

    for (const name of intentNames) {
      intentTextScore += calculateIntentKeywordScore(
        normalizedMessage,
        chunkText,
        intentKeywordMap[name] || []
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

  /* ---------- FINAL FILTER (PHASE 2 DYNAMIC THRESHOLD) ---------- */
  const used = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (!c.text) return false;
    if (c.fusionScore < threshold) return false;

    const key = normalize(c.text).slice(0, 120);
    if (used.has(key)) return false;

    used.add(key);
    return true;
  });

  return finalChunks.slice(0, baseTopN);
}
