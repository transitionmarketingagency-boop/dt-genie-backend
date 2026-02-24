// server/queryChunks.ts
import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const DEBUG = process.env.DEBUG_CHUNKS === "true";

// Persistent embedding cache to avoid repeated getEmbedding calls
const EMB_CACHE_FILE = path.join(process.cwd(), "server", "vector_store", ".queryEmbCache.json");
let queryEmbeddingCache: Map<string, number[]> = new Map();
try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    queryEmbeddingCache = new Map(Object.entries(JSON.parse(raw)));
  }
} catch {
  console.warn("⚠️ Failed to load query embedding cache, starting fresh.");
}
function saveQueryCache() {
  try {
    fs.writeFileSync(EMB_CACHE_FILE, JSON.stringify(Object.fromEntries(queryEmbeddingCache)), "utf-8");
  } catch {
    console.warn("⚠️ Failed to save query embedding cache.");
  }
}

/**
 * Compute cosine similarity safely
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;
  const minLen = Math.min(vecA.length, vecB.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < minLen; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load all chunks safely
 */
function loadChunks(): { text: string; source: string | null; embedding: number[] }[] {
  if (!fs.existsSync(chunksPath)) {
    console.error("⚠️ chunks.json not found:", chunksPath);
    return [];
  }

  try {
    const raw = fs.readFileSync(chunksPath, "utf-8");
    const chunks = JSON.parse(raw);
    if (!Array.isArray(chunks)) throw new Error("chunks.json is not an array");
    return chunks
      .filter(c => c?.text && Array.isArray(c.embedding))
      .map(c => ({
        text: c.text,
        source: c.source || null,
        embedding: c.embedding
      }));
  } catch (err) {
    console.error("⚠️ Failed to parse chunks.json:", err);
    return [];
  }
}

/**
 * Retrieve top relevant chunks for a query
 */
export async function getTopChunks(
  queryText: string,
  limit = 8,
  minSimilarity = 0.25
) {
  if (!queryText || !queryText.trim()) return [];

  const chunks = loadChunks();
  if (chunks.length === 0) return [];

  let queryEmbedding: number[] = [];
  if (queryEmbeddingCache.has(queryText)) {
    queryEmbedding = queryEmbeddingCache.get(queryText)!;
  } else {
    queryEmbedding = await getEmbedding(queryText);
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error("⚠️ Invalid query embedding");
      return [];
    }
    queryEmbeddingCache.set(queryText, queryEmbedding);
    saveQueryCache();
  }

  // Score and sort
  const scored = chunks
    .map(c => ({
      text: c.text,
      source: c.source,
      score: cosineSimilarity(queryEmbedding, c.embedding)
    }))
    .sort((a, b) => b.score - a.score);

  if (DEBUG) {
    console.log(`🔹 ${scored.length} chunks scored for query: "${queryText}"`);
    scored.slice(0, 5).forEach((c, i) =>
      console.log(`${i + 1}. Score=${c.score.toFixed(3)} | ${c.text.slice(0, 80)}...`)
    );
  }

  // Return filtered
  const filtered = scored.filter(c => c.score >= minSimilarity);
  return filtered.length > 0 ? filtered.slice(0, limit) : scored.slice(0, Math.min(limit, scored.length));
}
