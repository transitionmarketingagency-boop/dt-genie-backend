// server/queryChunks.ts
import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

/* ================= PATH RESOLUTION ================= */
const distPath = path.resolve("dist/server/vector_store/chunks.json");
const devPath = path.resolve("server/vector_store/chunks.json");
export const chunksPath = fs.existsSync(distPath) ? distPath : devPath;

console.log("📦 Loading chunks.json from:", chunksPath);

const EMB_CACHE_FILE = path.resolve(path.dirname(chunksPath), ".queryEmbCache.json");
const DEBUG = process.env.DEBUG_CHUNKS === "true";

/* ================= QUERY CACHE ================= */
let queryEmbeddingCache: Map<string, number[]> = new Map();

function normalizeQuery(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

// Load cached embeddings
try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    queryEmbeddingCache = new Map(
      Object.entries(parsed).map(([k, v]) => [k, (v as number[]).map(Number)])
    );
    if (DEBUG) {
      console.log(`[QueryChunks] Loaded ${queryEmbeddingCache.size} cached embeddings`);
    }
  }
} catch (err) {
  console.warn("[QueryChunks] ⚠️ Failed to load embedding cache. Starting fresh.", err);
}

function saveQueryCache() {
  try {
    fs.writeFileSync(
      EMB_CACHE_FILE,
      JSON.stringify(Object.fromEntries(queryEmbeddingCache)),
      "utf-8"
    );
  } catch (err) {
    console.warn("[QueryChunks] ⚠️ Failed to save embedding cache.", err);
  }
}

/* ================= COSINE SIMILARITY ================= */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length !== vecB.length) {
    console.warn("[QueryChunks] ⚠️ Embedding length mismatch:", vecA.length, vecB.length);
    return 0;
  }

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

/* ================= LOAD CHUNKS ================= */
export function loadChunks(): { text: string; source: string | null; embedding: number[] }[] {
  if (!fs.existsSync(chunksPath)) {
    console.error("[QueryChunks] ⚠️ chunks.json not found:", chunksPath);
    return [];
  }

  try {
    const raw = fs.readFileSync(chunksPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("chunks.json is not an array");

    return parsed
      .filter((c) => c?.text && Array.isArray(c.embedding))
      .map((c) => ({
        text: String(c.text),
        source: typeof c.source === "string" ? c.source : null,
        embedding: c.embedding.map(Number),
      }));
  } catch (err) {
    console.error("[QueryChunks] ⚠️ Failed to parse chunks.json:", err);
    return [];
  }
}

/* ================= TOP CHUNKS RETRIEVAL ================= */
export async function getTopChunks(
  queryText: string,
  limit = 8,
  minSimilarity = 0.18
): Promise<{ text: string; source: string | null; score: number }[]> {
  if (!queryText || !queryText.trim()) return [];

  const normalizedQuery = normalizeQuery(queryText);
  const chunks = loadChunks();
  if (chunks.length === 0) return [];

  let queryEmbedding: number[];

  // Use cached embedding if exists
  if (queryEmbeddingCache.has(normalizedQuery)) {
    queryEmbedding = queryEmbeddingCache.get(normalizedQuery)!;
  } else {
    try {
      // 🔥 Generate embedding via Python / Qwen model
      queryEmbedding = await getEmbedding(queryText);

      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        console.warn("[QueryChunks] ⚠️ Failed to generate embedding for query");
        return [];
      }

      // Cache the embedding
      queryEmbeddingCache.set(normalizedQuery, queryEmbedding);
      saveQueryCache();
    } catch (err) {
      console.error("[QueryChunks] ⚠️ Embedding generation error:", err);
      return [];
    }
  }

  // Score all chunks
  const scored = chunks
    .map((c) => ({
      text: c.text,
      source: c.source,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  if (DEBUG) {
    console.log(`\n[QueryChunks DEBUG] Query: "${queryText}"`);
    scored.slice(0, 5).forEach((c, i) => {
      console.log(`${i + 1}. Score=${c.score.toFixed(4)} | ${c.text.slice(0, 80)}...`);
    });
  }

  // Filter by similarity threshold
  const filtered = scored.filter((c) => c.score >= minSimilarity);
  return filtered.length > 0
    ? filtered.slice(0, limit)
    : scored.slice(0, Math.min(limit, scored.length));
}
