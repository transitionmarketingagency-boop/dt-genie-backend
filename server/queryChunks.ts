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

console.log("📦 Loading chunks from:", chunksPath);

/* ================= CHUNK TYPE ================= */

export type Chunk = {
  text: string;
  source: string | null;
  embedding: number[];
  intent?: string;
};

/* ================= LOAD CHUNKS ================= */

let cachedChunks: Chunk[] = [];
let embeddingSize = 0;

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
      .map((c: any) => ({
        text: String(c.text),
        source: typeof c.source === "string" ? c.source : null,
        embedding: c.embedding.map(Number).filter((n: number) => !Number.isNaN(n)),
        intent: typeof c.intent === "string" ? c.intent : undefined,
      }))
      .filter((c: Chunk) => c.embedding.length > 100 && c.text.length > 30);

    if (cachedChunks.length > 0) {
      embeddingSize = cachedChunks[0].embedding.length;
    }

    console.log(`✅ ${cachedChunks.length} chunks loaded`);
    console.log(`🧠 Embedding dimension: ${embeddingSize}`);
  } catch (err) {
    console.error("❌ Failed to load chunks:", err);
  }
})();

/* ================= COSINE SIMILARITY ================= */

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ================= QUERY CACHE ================= */

const queryEmbeddingCache = new Map<string, number[]>();
const CACHE_LIMIT = 200;

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheEmbedding(key: string, embedding: number[]) {
  if (queryEmbeddingCache.size >= CACHE_LIMIT) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    if (firstKey !== undefined) queryEmbeddingCache.delete(firstKey);
  }
  queryEmbeddingCache.set(key, embedding);
}

/* ================= MAIN RETRIEVAL ================= */

export async function getTopChunks(
  queryText: string,
  limit = 6,
  minSimilarity = 0.6
): Promise<{ text: string; source: string | null; score: number; intent?: string }[]> {

  if (!queryText?.trim()) return [];

  const normalized = normalizeQuery(queryText);

  let queryEmbedding = queryEmbeddingCache.get(normalized);

  /* ================= GENERATE EMBEDDING ================= */

  if (!queryEmbedding) {
    try {

      queryEmbedding = await getQwenEmbedding(normalized);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error("❌ Empty embedding returned");
        return [];
      }

      if (embeddingSize && queryEmbedding.length !== embeddingSize) {
        console.error("❌ Embedding dimension mismatch");
        return [];
      }

      cacheEmbedding(normalized, queryEmbedding);

    } catch (err) {
      console.error("❌ Qwen embedding failed:", err);
      return [];
    }
  }

  /* ================= SCORE CHUNKS ================= */

  const scored = cachedChunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding!, chunk.embedding),
  }));

  if (scored.length === 0) return [];

  /* ================= SORT ================= */

  scored.sort((a, b) => b.score - a.score);

  /* ================= FILTER ================= */

  const filtered = scored.filter((s) => s.score >= minSimilarity);

  if (!filtered.length) {
    console.log("⚠️ No chunks above similarity threshold");
    return [];
  }

  const unique = new Set<string>();

  const results: {
    text: string;
    source: string | null;
    score: number;
    intent?: string;
  }[] = [];

  for (const item of filtered) {

    const text = item.chunk.text.trim();

    if (unique.has(text)) continue;

    unique.add(text);

    results.push({
      text,
      source: item.chunk.source,
      score: Number(item.score.toFixed(4)),
      intent: item.chunk.intent,
    });

    if (results.length >= limit) break;

  }

  return results;

}
