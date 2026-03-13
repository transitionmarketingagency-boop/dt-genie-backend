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

/* ======================= FUSION WEIGHTS ======================= */

const VECTOR_WEIGHT = 0.65;
const INTENT_WEIGHT = 0.25;
const KEYWORD_WEIGHT = 0.1;
const SERVICE_BOOST = 0.05;

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

  return overlap / Math.max(setA.size, 1);
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

/* ======================= FUSION FUNCTION ======================= */

export async function getFusedChunks(
  userMessage: string,
  baseTopN: number = 6
): Promise<
  { text: string; source: string; fusionScore: number; intent: string }[]
> {
  const normalizedMessage = normalize(userMessage);

  /* ================= DYNAMIC TOP-N ================= */

  const complexity = complexityScore(userMessage);

  const topN = Math.max(baseTopN, Math.ceil(baseTopN * (1 + complexity)));

  /* ================= NEURAL QUERY EXPANSION + VECTOR SEARCH ================= */

  // Uses new neural query expansion from getTopChunks internally
  const vectorChunks: VectorChunk[] = await getTopChunks(userMessage, topN * 2, 0.5);

  if (!vectorChunks?.length) return [];

  /* ================= INTENT DETECTION ================= */

  const detectedIntents = detectIntent(userMessage, 3);

  const intentsWithScore = detectedIntents.length
    ? detectedIntents
    : [{ intent: { name: "general" } as Intent, score: 0.2 }];

  /* ================= FUSION ================= */

  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalize(chunk.text);

    /* VECTOR SIMILARITY */
    const vectorScore = chunk.score || 0;

    /* INTENT MATCH */
    let intentScore = 0;
    for (const detected of intentsWithScore) {
      if (chunk.intent && detected.intent.name === chunk.intent) {
        intentScore = detected.score ?? 0.2;
        break;
      }
    }

    /* KEYWORD OVERLAP */
    const keywordScore = keywordOverlap(normalizedMessage, chunkText);

    /* EXTRA INTENT KEYWORD MATCH */
    const intentKeywordBoost = intentKeywordScore(normalizedMessage, chunkText);

    /* SERVICE BOOST */
    const serviceScore = serviceBoost(chunkText);

    /* FINAL SCORE */
    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentScore +
      KEYWORD_WEIGHT * keywordScore +
      intentKeywordBoost +
      serviceScore;

    return {
      ...chunk,
      fusionScore,
    };
  });

  /* ================= SORT ================= */

  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  /* ================= RETURN ================= */

  const topChunks = fused.slice(0, topN);

  return topChunks.map((c) => ({
    text: c.text,
    source: c.source,
    fusionScore: Number(c.fusionScore.toFixed(4)),
    intent: c.intent ?? "general",
  }));
}
