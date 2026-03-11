import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getEmbedding as getQwenEmbedding } from "./services/openRouterEmbeddingsClient.js";

/* ================= PATH RESOLUTION ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "vector_store", "chunks.json");
const devPath = path.join(__dirname, "../vector_store/chunks.json");

const chunksPath = fs.existsSync(distPath) ? distPath : devPath;

console.log("📚 Loading vector chunks from:", chunksPath);

/* ================= CHUNK TYPE ================= */

export type Chunk = {
  text: string;
  source: string;
  embedding: number[];
  intent: string;
};

/* ================= STORAGE ================= */

let cachedChunks: Chunk[] = [];
let embeddingSize = 0;

/* ================= BLOCKED PLATFORMS ================= */

const blockedPlatforms = [
  "kling",
  "midjourney",
  "runway",
  "pika",
  "openai",
  "anthropic",
  "replicate",
  "stability ai"
];

/* ================= LOAD CHUNKS ================= */

(function loadChunksOnce() {

  if (!fs.existsSync(chunksPath)) {
    console.error("❌ chunks.json not found:", chunksPath);
    return;
  }

  try {

    const raw = fs.readFileSync(chunksPath, "utf-8");
    const parsed = JSON.parse(raw);

    cachedChunks = parsed
      .filter((c: any) => c?.text && Array.isArray(c.embedding))
      .map((c: any) => {

        const cleanText = String(c.text).trim();

        return {
          text: cleanText,
          source:
            typeof c.source === "string" && c.source.trim()
              ? c.source
              : "Digital Transition Marketing",

          embedding: c.embedding
            .map(Number)
            .filter((n: number) => !Number.isNaN(n)),

          intent:
            typeof c.intent === "string" && c.intent.trim()
              ? c.intent
              : "general"
        };

      })
      .filter((c: Chunk) =>
        c.embedding.length > 100 &&
        c.text.length > 30 &&
        !blockedPlatforms.some(p =>
          c.text.toLowerCase().includes(p)
        )
      );

    if (cachedChunks.length > 0) {
      embeddingSize = cachedChunks[0].embedding.length;
    }

    console.log(`✅ ${cachedChunks.length} chunks loaded`);
    console.log(`📐 Embedding dimension: ${embeddingSize}`);

  } catch (err) {
    console.error("❌ Failed to load chunks:", err);
  }

})();

/* ================= COSINE SIMILARITY ================= */

function cosineSimilarity(vecA: number[], vecB: number[]): number {

  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {

    const a = vecA[i];
    const b = vecB[i];

    dot += a * b;
    normA += a * a;
    normB += b * b;

  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));

}

/* ================= QUERY CACHE ================= */

const queryEmbeddingCache = new Map<string, number[]>();
const CACHE_LIMIT = 200;

/* ================= NORMALIZE ================= */

function normalizeQuery(text: string) {

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

/* ================= CACHE ================= */

function cacheEmbedding(key: string, embedding: number[]) {

  if (queryEmbeddingCache.size >= CACHE_LIMIT) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    if (firstKey) queryEmbeddingCache.delete(firstKey);
  }

  queryEmbeddingCache.set(key, embedding);

}

/* ================= MAIN RETRIEVAL ================= */

export async function getTopChunks(
  queryText: string,
  limit = 4,
  minSimilarity = 0.60
): Promise<{ text: string; source: string; score: number; intent: string }[]> {

  if (!queryText?.trim()) return [];

  const normalized = normalizeQuery(queryText);

  let queryEmbedding = queryEmbeddingCache.get(normalized);

  /* ===== GENERATE EMBEDDING ===== */

  if (!queryEmbedding) {

    try {

      queryEmbedding = await getQwenEmbedding(normalized);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error("❌ Empty embedding returned");
        return [];
      }

      if (embeddingSize && queryEmbedding.length !== embeddingSize) {
        console.error(
          `❌ Embedding mismatch expected ${embeddingSize} got ${queryEmbedding.length}`
        );
        return [];
      }

      cacheEmbedding(normalized, queryEmbedding);

    } catch (err) {

      console.error("❌ Embedding generation failed:", err);
      return [];

    }

  }

  /* ================= SCORE CHUNKS ================= */

  const scored = cachedChunks.map((chunk) => {

    const similarity = cosineSimilarity(queryEmbedding!, chunk.embedding);

    return {
      chunk,
      score: similarity
    };

  });

  if (!scored.length) return [];

  /* ================= SORT BY SCORE ================= */

  scored.sort((a, b) => b.score - a.score);

  /* ================= FILTER ================= */

  let filtered = scored.filter(s => s.score >= minSimilarity);

  /* fallback if threshold too strict */

  if (!filtered.length) {

    filtered = scored.slice(0, 2);

    console.log("⚠️ Using fallback vector results");

  }

  /* ================= UNIQUE ================= */

  const seen = new Set<string>();
  const results: {
    text: string;
    source: string;
    score: number;
    intent: string;
  }[] = [];

  for (const item of filtered) {

    const text = item.chunk.text.trim();

    if (!text) continue;

    if (seen.has(text)) continue;

    seen.add(text);

    results.push({
      text: text.slice(0, 900),
      source: item.chunk.source,
      score: Number(item.score.toFixed(4)),
      intent: item.chunk.intent
    });

    if (results.length >= limit) break;

  }

  console.log(
    `🔎 Vector search | Query="${normalized.slice(0, 40)}" | Results=${results.length}`
  );

  return results;

}
