import { getTopChunks } from "../queryChunks.js";
import { detectIntent, Intent, intents } from "./intentManager.js";

/* ======================= TYPES ======================= */

type VectorChunk = {
  text: string;
  source: string;
  score: number;
  intent: string;
};

/* ======================= FUSION WEIGHTS ======================= */

const VECTOR_WEIGHT = 0.65;
const INTENT_WEIGHT = 0.25;
const KEYWORD_WEIGHT = 0.1;
const SERVICE_BOOST = 0.05;
const PRICING_BOOST = 0.08; // 🔥 NEW

/* ======================= SAFETY LIMITS ======================= */

const MAX_CHUNKS = 5;
const MIN_SCORE_THRESHOLD = 0.15; // 🔥 NEW (filters weak chunks)

/* ======================= TEXT NORMALIZATION ======================= */

function normalize(text: string): string {
  return (
    text
      ?.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

/* ======================= TOKENIZE ======================= */

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/* ======================= KEYWORD OVERLAP ======================= */

function keywordOverlap(a: string, b: string) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));

  let overlap = 0;

  for (const word of setA) {
    if (setB.has(word)) overlap++;
  }

  // 🔥 normalized overlap (better scaling)
  return overlap / Math.max(Math.sqrt(setA.size * setB.size), 1);
}

/* ======================= MESSAGE COMPLEXITY ======================= */

function complexityScore(message: string) {
  const tokens = tokenize(message);

  const lenScore = Math.min(tokens.length / 40, 1);
  const uniqueScore = Math.min(new Set(tokens).size / 40, 1);

  return (lenScore + uniqueScore) / 2;
}

/* ======================= INTENT KEYWORD MATCH ======================= */

function intentKeywordScore(message: string, chunkText: string) {
  let score = 0;

  for (const intent of intents) {
    for (const kw of intent.keywords) {
      const kwNorm = normalize(kw);

      if (chunkText.includes(kwNorm) && message.includes(kwNorm)) {
        score += 0.02;
      }
    }
  }

  return Math.min(score, 0.15);
}

/* ======================= SERVICE BOOST ======================= */

function serviceBoost(chunkText: string) {
  for (const intent of intents) {
    if (intent.category === "service") {
      for (const kw of intent.keywords) {
        if (chunkText.includes(normalize(kw))) {
          return SERVICE_BOOST;
        }
      }
    }
  }
  return 0;
}

/* ======================= PRICING BOOST (NEW) ======================= */

function pricingBoost(chunkText: string, message: string) {
  const msg = normalize(message);

  if (
    msg.includes("price") ||
    msg.includes("cost") ||
    msg.includes("pricing") ||
    msg.includes("package")
  ) {
    if (/\$\d+/.test(chunkText) || chunkText.includes("price")) {
      return PRICING_BOOST;
    }
  }

  return 0;
}

/* ======================= MAIN FUSION FUNCTION ======================= */

async function getFusedChunksInternal(
  userMessage: string,
  baseTopN: number = 6
): Promise<
  { text: string; source: string; fusionScore: number; intent: string }[]
> {
  const normalizedMessage = normalize(userMessage);

  const complexity = complexityScore(userMessage);

  let topN = Math.max(
    baseTopN,
    Math.ceil(baseTopN * (1 + complexity))
  );

  if (topN > MAX_CHUNKS) {
    topN = MAX_CHUNKS;
  }

  const vectorChunks: VectorChunk[] =
    await getTopChunks(userMessage, topN * 2, 0.5);

  if (!vectorChunks?.length) return [];

  let detectedIntents: { intent: Intent; score?: number }[] = [];

  try {
    const detected = detectIntent(userMessage, 3);
    if (Array.isArray(detected)) detectedIntents = detected;
  } catch {}

  const intentsWithScore = detectedIntents.length
    ? detectedIntents
    : [{ intent: { name: "general" } as Intent, score: 0.2 }];

  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text || "");

    const vectorScore = chunk.score || 0;

    let intentScore = 0.1; // 🔥 default fallback (better than 0)

    for (const detected of intentsWithScore) {
      if (chunk.intent && detected.intent.name === chunk.intent) {
        intentScore = detected.score ?? 0.2;
        break;
      }
    }

    const keywordScore = keywordOverlap(normalizedMessage, chunkText);

    const intentKeywordBoost =
      intentKeywordScore(normalizedMessage, chunkText);

    const serviceScore = serviceBoost(chunkText);

    const pricingScore = pricingBoost(chunkText, normalizedMessage);

    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentScore +
      KEYWORD_WEIGHT * keywordScore +
      intentKeywordBoost +
      serviceScore +
      pricingScore;

    return {
      ...chunk,
      fusionScore,
    };
  });

  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  const filtered = fused.filter((c) => c.fusionScore >= MIN_SCORE_THRESHOLD);

  const topChunks = (filtered.length ? filtered : fused).slice(0, topN);

  return topChunks.map((c) => ({
    text: c.text,
    source: c.source,
    fusionScore: Number(c.fusionScore.toFixed(4)),
    intent: c.intent ?? "general",
  }));
}

/* ======================= EXPORT ======================= */

export { getFusedChunksInternal as getFusedChunks };
