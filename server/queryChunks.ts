// server/queryChunks.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getEmbedding } from "./services/openRouterEmbeddingsClient.js"

/* ================= PATH RESOLUTION ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "vector_store", "chunks.json");
const devPath = path.join(__dirname, "../vector_store/chunks.json");
export const chunksPath = fs.existsSync(distPath) ? distPath : devPath;

console.log(" ~B Loading chunks.json from:", chunksPath);

const EMB_CACHE_FILE = path.join(path.dirname(chunksPath), ".queryEmbCache.json");
const DEBUG = process.env.DEBUG_CHUNKS === "true";

/* ================= CHUNK TYPE ================= */
type Chunk = {
  text: string;
  source: string | null;
  embedding: number[];
};

/* ================= LOAD CHUNKS ONCE ================= */
let cachedChunks: Chunk[] = [];

function loadChunksOnce(): Chunk[] {
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

    console.log(`[QueryChunks] ✅ Loaded ${cachedChunks.length} chunks into memory`);
    return cachedChunks;
  } catch (err) {
    console.error("[QueryChunks] ⚠️ Failed to parse chunks.json:", err);
    return [];
  }
}

/* ================= QUERY EMBEDDING CACHE ================= */
let queryEmbeddingCache: Map<string, number[]> = new Map();

function normalizeQuery(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

try {
  if (fs.existsSync(EMB_CACHE_FILE)) {
    const raw = fs.readFileSync(EMB_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    queryEmbeddingCache = new Map(
      Object.entries(parsed).map(([k, v]) => [k, (v as number[]).map(Number)])
    );
    if (DEBUG) console.log("[QueryChunks] ✅ Loaded embedding cache.");
  }
} catch (err) {
  console.warn("[QueryChunks] ⚠️ Failed to load embedding cache.", err);
}

function saveQueryCache() {
  try {
    fs.writeFileSync(
      EMB_CACHE_FILE,
      JSON.stringify(Object.fromEntries(queryEmbeddingCache)),
      "utf-8"
    );
    if (DEBUG) console.log("[QueryChunks] ✅ Saved embedding cache.");
  } catch (err) {
    console.warn("[QueryChunks] ⚠️ Failed to save embedding cache.", err);
  }
}

/* ================= COSINE SIMILARITY ================= */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length)
    return 0;

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }

  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

/* ================= SEMANTIC DEDUPLICATION ================= */
function semanticDeduplicate(
  candidates: (Chunk & { score: number })[],
  limit: number,
  similarityThreshold = 0.92
) {
  const selected: (Chunk & { score: number })[] = [];

  for (const candidate of candidates) {
    let isDuplicate = false;

    for (const existing of selected) {
      const sim = cosineSimilarity(candidate.embedding, existing.embedding);
      if (sim >= similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      selected.push(candidate);
    }

    if (selected.length >= limit) break;
  }

  return selected;
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
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];
      queryEmbeddingCache.set(normalizedQuery, queryEmbedding);
      saveQueryCache();
    } catch (err) {
      console.error("[QueryChunks] ⚠️ getEmbedding failed:", err);
      return [];
    }
  }

  const scored = chunks.map((c) => ({
    ...c,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const filtered = scored.filter((c) => c.score >= minSimilarity);

  const candidatePool =
    filtered.length > 0
      ? filtered.slice(0, limit * 5)
      : scored.slice(0, limit * 5);

  const deduplicated = semanticDeduplicate(candidatePool, limit);

  if (DEBUG) {
    console.log(`\n[QueryChunks DEBUG] Final semantic results:`);
    deduplicated.forEach((c, i) => {
      console.log(`${i + 1}. Score=${c.score.toFixed(4)} | Source=${c.source}`);
    });
  }

  return deduplicated.map(({ text, source, score }) => ({
    text,
    source,
    score,
  }));
}
