// server/queryChunks.ts

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

console.log("📚 Loading chunks from:", chunksPath);

/* ================= CHUNK TYPE ================= */

type Chunk = {
  text: string;
  source: string | null;
  embedding: number[];
};

/* ================= LOAD CHUNKS (IN MEMORY) ================= */

let cachedChunks: Chunk[] = [];

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
        embedding: c.embedding.map(Number).filter((n: number) => !Number.isNaN(n))
      }));

    console.log(`✅ ${cachedChunks.length} chunks loaded into memory`);

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

function normalizeQuery(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/* ================= MAIN RETRIEVAL ================= */

export async function getTopChunks(
  queryText: string,
  limit = 8,
  minSimilarity = 0.18
): Promise<{ text: string; source: string | null; score: number }[]> {

  if (!queryText?.trim()) return [];

  const normalized = normalizeQuery(queryText);

  let queryEmbedding = queryEmbeddingCache.get(normalized);

  /* ================= GENERATE EMBEDDING ================= */

  if (!queryEmbedding) {

    try {

      queryEmbedding = await getQwenEmbedding(queryText);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error("❌ Empty embedding returned");
        return [];
      }

      queryEmbeddingCache.set(normalized, queryEmbedding);

    } catch (err) {

      console.error("❌ Qwen embedding failed:", err);
      return [];

    }

  }

  /* ================= PASS 1: RETRIEVE ================= */

  const scored: { chunk: Chunk; score: number }[] = [];

  for (const chunk of cachedChunks) {

    const score = cosineSimilarity(queryEmbedding, chunk.embedding);

    if (score >= minSimilarity) {
      scored.push({ chunk, score });
    }

  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  /* ================= PASS 2: LIGHT RERANK ================= */

  const rerankPool = scored.slice(0, Math.max(limit * 2, 12));

  const reranked = rerankPool.map((item) => ({
    ...item,
    score: item.score * 0.92 + Math.random() * 0.008
  }));

  reranked.sort((a, b) => b.score - a.score);

  /* ================= RETURN ================= */

  return reranked.slice(0, limit).map(({ chunk, score }) => ({
    text: chunk.text,
    source: chunk.source,
    score,
  }));

}
