// server/services/intentVectorFusion.ts

import { Chunk, getTopChunks } from "../queryChunks.js";
import { detectIntent, Intent, intents } from "./intentManager.js";

/* ======================= FUSION WEIGHTS ======================= */
const VECTOR_WEIGHT = 0.65;
const INTENT_WEIGHT = 0.25;
const KEYWORD_WEIGHT = 0.1;
const SERVICE_BOOST = 0.05;

/* ======================= UTILS ======================= */
function keywordOverlap(a: string, b: string) {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.max(setA.size, 1);
}

// Estimate message complexity for dynamic top-N
function complexityScore(message: string) {
  const lenScore = Math.min(message.length / 300, 1); // cap at 1
  const uniqueWords = new Set(message.split(" ")).size;
  const wordScore = Math.min(uniqueWords / 50, 1); // cap at 1
  return 0.5 * lenScore + 0.5 * wordScore;
}

// Normalize text safely
function normalizeText(text: string) {
  return text?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

/* ======================= FUSION FUNCTION ======================= */
export async function getFusedChunks(
  userMessage: string,
  baseTopN: number = 6
): Promise<
  { text: string; source: string; fusionScore: number; intent: string }[]
> {
  const normalizedMessage = normalizeText(userMessage);

  // 1️⃣ Dynamic top-N based on message complexity
  const topN = Math.max(baseTopN, Math.ceil(baseTopN * (1 + complexityScore(userMessage))));

  // 2️⃣ Get vector chunks (fetch extra for fusion scoring)
  const vectorChunks = await getTopChunks(userMessage, topN * 2, 0.5);
  if (!vectorChunks?.length) return [];

  // 3️⃣ Detect top 3 intents dynamically
  const detectedIntents = detectIntent(userMessage, 3);
  const intentsWithScore = detectedIntents.length
    ? detectedIntents
    : [{ intent: { name: "general" } as Intent, score: 0.2 }];

  // 4️⃣ Compute fusion score for each chunk
  const fused = vectorChunks.map((chunk) => {
    const chunkText = normalizeText(chunk.text);

    // Vector similarity
    const vectorScore = chunk.score;

    // Intent match boost
    let intentScore = 0;
    for (const i of intentsWithScore) {
      if (i.intent.name === chunk.intent) {
        intentScore = i.score ?? 0.2;
        break;
      }
    }

    // Keyword overlap
    const keywordScore = keywordOverlap(normalizedMessage, chunkText);

    // Service relevance boost
    let serviceScore = 0;
    for (const svc of intents.filter((i) => i.category === "service")) {
      if (chunkText.includes(normalizeText(svc.name))) {
        serviceScore = SERVICE_BOOST;
        break;
      }
    }

    // Final fusion score
    const fusionScore =
      VECTOR_WEIGHT * vectorScore +
      INTENT_WEIGHT * intentScore +
      KEYWORD_WEIGHT * keywordScore +
      serviceScore;

    return { ...chunk, fusionScore };
  });

  // 5️⃣ Sort by fusion score descending
  fused.sort((a, b) => b.fusionScore - a.fusionScore);

  // 6️⃣ Return top dynamically calculated chunks
  const topChunks = fused.slice(0, topN);

  // 7️⃣ Optional debug log
  // console.log("🔮 Fused Chunks:", topChunks.map(c => ({intent: c.intent, score: c.fusionScore.toFixed(3), text: c.text.slice(0,60)})));

  return topChunks.map(c => ({
    text: c.text,
    source: c.source,
    fusionScore: Number(c.fusionScore.toFixed(4)),
    intent: c.intent
  }));
}
