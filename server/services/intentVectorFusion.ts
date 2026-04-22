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
const VECTOR_WEIGHT = 0.78; // 🔥 increased dominance
const INTENT_WEIGHT = 0.16; // 🔥 reduced (fix hallucination)
const KEYWORD_WEIGHT = 0.10;

const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08;
const BOOKING_BOOST = 0.08;

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

  let base = 0.30;

  if (/(price|cost|pricing)/.test(msg)) base -= 0.07;
  if (/(book|call|meeting|schedule|appointment)/.test(msg)) base -= 0.09;
  if (/(service|agency|offer|solution)/.test(msg)) base -= 0.05;
  if (/(how|help|need|want|suggest)/.test(msg)) base -= 0.05;

  return Math.max(0.22, Math.min(0.42, base));
}

/* ================= INTENT SCORE (CLEANED) ================= */

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
    const kwTokens = tokenize(kw);

    const match = kwTokens.every((t) => chunkTokens.has(t));

    if (match) {
      const overlap = keywordOverlap(msgTokens, new Set(kwTokens));
      score += overlap * 0.15;
    }

    if (score > 0.28) break;
  }

  return Math.min(score, 0.28);
}

/* ================= BOOST SYSTEM ================= */

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

/* ================= CHUNK VALIDATION ================= */

function isValidChunk(text: string): boolean {
  if (!text) return false;

  const clean = normalize(text);

  if (clean.length < 25) return false;
  if (clean.split(" ").length < 6) return false;

  if (/undefined|null|error|loading/i.test(clean)) return false;

  return true;
}

/* ================= DEDUPE ================= */

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

/* ================= MAIN FUSION ENGINE ================= */

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
    vectorChunks = await getTopChunks(userMessage, baseTopN + 6, 0.45);
  } catch (err) {
    console.error("Vector fetch failed:", err);
    return [];
  }

  if (!vectorChunks?.length) return [];

  /* ---------- CLEAN + HARD VECTOR FLOOR ---------- */
  vectorChunks = dedupeChunks(vectorChunks)
    .filter((c) => isValidChunk(c.text))
    .filter((c) => (c.score ?? 0) > 0.20); // 🔥 CRITICAL FIX

  /* ---------- INTENT DETECTION ---------- */
  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    detectedIntents = detectIntent(userMessage, [], 5);
  } catch {}

  const intentNames = detectedIntents.map((d) => d.intent.name);

  const intentScores: Record<string, number> = {};
  for (const d of detectedIntents) {
    intentScores[d.intent.name] = Math.min(d.score ?? 0.2, 0.18);
  }

  const intentKeywordMap: Record<string, string[]> = {};

  for (const name of intentNames) {
    const found = intents.find((i) => i.name === name);

    intentKeywordMap[name] = (found?.keywords || [])
      .map(normalize)
      .filter(Boolean);
  }

  /* ---------- SCORING ---------- */
  const threshold = dynamicThreshold(userMessage);
  const adjustedThreshold = threshold * 0.88; // 🔥 SAFE RELAXATION

  const fused: FusedChunk[] = vectorChunks.map((chunk) => {

    const rawText = chunk.text;
    const chunkText = normalize(rawText);
    const chunkTokens = new Set(tokenize(chunkText));

    const vectorScore = Math.min(chunk.score ?? 0, 1);
    const keywordScore = keywordOverlap(messageTokens, chunkTokens);

    /* ---------- INTENT BOOST (CONTROLLED) ---------- */
    let intentBoost = 0;

    for (const name of intentNames) {
      const keywords = intentKeywordMap[name] || [];

      const match = keywords.some((kw) => {
        const kwTokens = tokenize(kw);
        return kwTokens.every((t) => chunkTokens.has(t));
      });

      if (match) {
        intentBoost += Math.min(intentScores[name] ?? 0.12, 0.08);
      }
    }

    /* ---------- INTENT TEXT SCORE ---------- */
    let intentTextScore = 0;

    for (const name of intentNames) {
      intentTextScore += calculateIntentKeywordScore(
        normalizedMessage,
        chunkText,
        intentKeywordMap[name] || []
      );
    }

    intentTextScore = Math.min(intentTextScore, 0.25);

    /* ---------- VECTOR-FIRST FUSION (FIXED CORE) ---------- */

    const vectorCore = vectorScore * 1.25; // 🔥 PRIMARY AUTHORITY
    const intentCore = intentBoost * 0.55;
    const keywordCore = keywordScore * 0.35;

    const systemBoosts =
      Math.min(serviceBoost(chunkText), 0.03) +
      Math.min(pricingBoost(chunkText, normalizedMessage), 0.04) +
      Math.min(bookingBoost(chunkText, normalizedMessage), 0.04);

    const fusionScore =
      vectorCore +
      intentCore +
      keywordCore +
      intentTextScore * 0.5 +
      systemBoosts;

    return {
      text: rawText,
      source: chunk.source,
      intent: chunk.intent ?? "general",
      fusionScore: Number(fusionScore.toFixed(4)),
    };
  });

  /* ---------- SORT ---------- */
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  /* ---------- FINAL FILTER ---------- */
  const used = new Set<string>();

  const finalChunks = fused.filter((c) => {
    if (!c.text) return false;

    if (c.fusionScore < adjustedThreshold) return false;

    const key = normalize(c.text).slice(0, 120);
    if (used.has(key)) return false;

    used.add(key);
    return true;
  });

  return finalChunks.slice(0, baseTopN);
}
