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

/* ================= LOAD CHUNKS ONCE ================= */
let cachedChunks: { text: string; source: string | null; embedding: number[] }[] = [];

function loadChunksOnce() {
  if (cachedChunks.length > 0) return cachedChunks;

  if (!fs.existsSync(chunksPath)) {
    console.error("[QueryChunks] ⚠️ chunks.json not found:", chunksPath);
    return [];
  }

  try {
    const raw = fs.readFileSync(chunksPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) throw new Error("chunks.json is not an array");

    cachedChunks = parsed
      .filter((c) => c?.text && Array.isArray(c.embedding))
      .map((c) => ({
        text: String(c.text),
        source: typeof c.source === "string" ? c.source : null,
        embedding: c.embedding.map(Number),
      }));

    console.log(`[QueryChunks] Loaded ${cachedChunks.length} chunks into memory`);
    return cachedChunks;
  } catch (err) {
    console.error("[QueryChunks] ⚠️ Failed to parse chunks.json:", err);
    return [];
  }
}

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
      console.log(`[QueryChunks] Loaded ${queryEmbeddingCache.size} cached query embeddings`);
    }
  }
} catch {
  console.warn("[QueryChunks] ⚠️ Failed to load embedding cache. Starting fresh.");
}

function saveQueryCache() {
  try {
    fs.writeFileSync(EMB_CACHE_FILE, JSON.stringify(Object.fromEntries(queryEmbeddingCache)), "utf-8");
  } catch {
    console.warn("[QueryChunks] ⚠️ Failed to save embedding cache.");
  }
}

/* ================= COSINE SIMILARITY ================= */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

/* ================= TOP CHUNKS RETRIEVAL ================= */
export async function getTopChunks(
  queryText: string,
  limit = 10,
  minSimilarity = 0.15
): Promise<{ text: string; source: string | null; score: number }[]> {
  if (!queryText?.trim()) return [];

  const normalizedQuery = normalizeQuery(queryText);
  const chunks = loadChunksOnce();
  if (chunks.length === 0) return [];

  let queryEmbedding: number[];

  if (queryEmbeddingCache.has(normalizedQuery)) {
    queryEmbedding = queryEmbeddingCache.get(normalizedQuery)!;
  } else {
    try {
      queryEmbedding = await getEmbedding(queryText);
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        console.warn("[QueryChunks] ⚠️ Failed to generate embedding for query");
        return [];
      }
      queryEmbeddingCache.set(normalizedQuery, queryEmbedding);
      saveQueryCache();
    } catch (err) {
      console.error("[QueryChunks] ⚠️ Embedding generation error:", err);
      return [];
    }
  }

  const scored = chunks.map((c) => ({
    text: c.text,
    source: c.source,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  if (DEBUG) {
    console.log(`\n[QueryChunks DEBUG] Query: "${queryText}"`);
    scored.slice(0, 5).forEach((c, i) => {
      console.log(`${i + 1}. Score=${c.score.toFixed(4)} | ${c.text.slice(0, 80)}...`);
    });
  }

  const filtered = scored.filter((c) => c.score >= minSimilarity);
  return filtered.length ? filtered.slice(0, limit) : scored.slice(0, Math.min(limit, scored.length));
}
