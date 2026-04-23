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
const INTENT_WEIGHT = 0.22;
const KEYWORD_WEIGHT = 0.12;

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

/* ======================= DYNAMIC THRESHOLD ======================= */
function dynamicThreshold(message: string): number {
  const msg = message.toLowerCase();

  let base = 0.32;

  if (/(price|cost|pricing)/.test(msg)) base -= 0.06;
  if (/(book|call|meeting|schedule)/.test(msg)) base -= 0.05;
  if (/(service|agency|offer)/.test(msg)) base -= 0.04;

  return Math.max(0.24, Math.min(0.42, base));
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

    if (score > 0.25) break;
  }

  return Math.min(score, 0.25);
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

/* ======================= CHUNK VALIDATION ======================= */
function isValidChunk(text: string): boolean {
  if (!text) return false;

  const clean = normalize(text);

  if (clean.length < 25) return false;
  if (clean.split(" ").length < 5) return false;
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

  let vectorChunks: VectorChunk[] = [];

  try {
    vectorChunks = await getTopChunks(userMessage, baseTopN + 6, 0.45);
  } catch (err) {
    console.error("[Vector Fetch Failed]", err);
    return [];
  }

vectorChunks = dedupeChunks(vectorChunks).filter((c) =>
  isValidChunk(c.text)
);

  /* ================= INTENTS ================= */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    detectedIntents = detectIntent(userMessage, [], 5);
  } catch {
    detectedIntents = [];
  }

  const intentNames = detectedIntents.map((d) => d.intent.name);

  const intentScores: Record<string, number> = {};
  const intentKeywordMap: Record<string, string[]> = {};

  for (const d of detectedIntents) {
    intentScores[d.intent.name] = d.score ?? 0.2;

    const found = intents.find((i) => i.name === d.intent.name);
    intentKeywordMap[d.intent.name] = found?.keywords ?? [];
  }

  const threshold = dynamicThreshold(userMessage);

  /* ================= FUSION ================= */
  const fused: FusedChunk[] = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text);
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = Math.min(chunk.score ?? 0, 1);
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    /* intent boost (CAPPED) */
    let intentBoost = 0;

    for (const name of intentNames.slice(0, 3)) {
      const keywords = intentKeywordMap[name] || [];
      const match = keywords.some((kw) => chunkTokens.has(kw));

      if (match) {
        intentBoost += Math.min(intentScores[name] ?? 0.15, 0.3);
      }
    }

    /* intent text score (capped) */
    let intentTextScore = 0;

    for (const name of intentNames.slice(0, 2)) {
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
      text: chunk.text,
      source: chunk.source,
      intent: chunk.intent ?? "general",
      fusionScore: Number(fusionScore.toFixed(4)),
    };
  });

  fused.sort((a, b) => b.fusionScore - a.fusionScore);

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
