import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getEmbeddingsBatch } from "./services/openRouterEmbeddingsClient.js";

/* ================= PATH RESOLUTION ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usePublicCandidateStaging =
  process.env.NEONVISION_USE_PUBLIC_STAGING === "true";

const stagingFilename = process.env.NEONVISION_PUBLIC_STAGING_FILE ||
  "public_candidate_staging_v1_3_8.json";

if (path.basename(stagingFilename) !== stagingFilename || !stagingFilename.endsWith(".json")) {
  throw new Error("NEONVISION_PUBLIC_STAGING_FILE must be a JSON filename inside server/vector_store.");
}

const stagingPath = path.join(
  __dirname,
  "vector_store",
  stagingFilename
);

const distPath = path.join(__dirname, "vector_store", "chunks.json");
const devPath = path.join(__dirname, "../vector_store/chunks.json");

const chunksPath = usePublicCandidateStaging
  ? stagingPath
  : fs.existsSync(distPath)
    ? distPath
    : devPath;

if (usePublicCandidateStaging && !fs.existsSync(stagingPath)) {
  throw new Error(`Public candidate staging corpus not found: ${stagingPath}`);
}

console.log("🧠 Loading vector chunks from:", chunksPath);

/* ================= TYPES ================= */

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
  "midjourney",
  "runway",
  "pika",
  "kling",
  "openai",
  "anthropic",
  "replicate",
  "stability ai",
  "creatify",
  "wisepops",
  "adcreative.ai",
  "aiclicks.io"
];

/* ================= VECTOR NORMALIZATION ================= */

function normalizeVector(vec: number[]) {
  if (!Array.isArray(vec) || vec.length === 0) return vec;

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (!norm) return vec;

  return vec.map(v => v / norm);
}

/* ================= TEXT NORMALIZATION ================= */

function normalize(text: string) {
  return text
    ?.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

/* ================= TOKENIZATION ================= */

function tokenize(text: string) {
  return normalize(text).split(" ").filter(Boolean);
}

/* ================= LOAD CHUNKS ================= */

(function loadChunksOnce() {
  if (!fs.existsSync(chunksPath)) {
    console.error("❌ chunks.json not found:", chunksPath);
    return;
  }

  try {
    const raw = fs.readFileSync(chunksPath, "utf8");
    const parsed = JSON.parse(raw);

    cachedChunks = parsed
      .filter((c: any) => c?.text && Array.isArray(c.embedding))
      .map((c: any) => {
        let embedding = c.embedding
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isFinite(n));

        embedding = normalizeVector(embedding);

        return {
          text: String(c.text).trim(),
          source: c.source || "Digital Transition Marketing",
          embedding,
          intent: c.intent || "general"
        };
      })
      .filter((c: Chunk) =>
        c.text.length > 40 &&
        c.embedding.length > 100 &&
        !blockedPlatforms.some(p => normalize(c.text).includes(p))
      );

    embeddingSize = cachedChunks?.[0]?.embedding?.length || 0;

    cachedChunks = cachedChunks.filter(
      c => c.embedding.length === embeddingSize
    );

    console.log(`✅ ${cachedChunks.length} chunks loaded`);
    console.log(`📐 Embedding dimension: ${embeddingSize}`);

  } catch (err) {
    console.error("❌ Failed to load chunks:", err);
  }
})();

/* ================= COSINE SIMILARITY (FIXED) ================= */

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) return 0;
  if (vecA.length !== vecB.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/* ================= QUERY CACHE ================= */

const queryEmbeddingCache = new Map<string, number[]>();
const CACHE_LIMIT = 200;

function cacheEmbedding(key: string, embedding: number[]) {
  if (embedding.length !== embeddingSize) return;

  if (queryEmbeddingCache.has(key)) {
    queryEmbeddingCache.delete(key);
  }

  queryEmbeddingCache.set(key, embedding);

  if (queryEmbeddingCache.size > CACHE_LIMIT) {
    const first = queryEmbeddingCache.keys().next().value;
    if (first !== undefined) queryEmbeddingCache.delete(first);
  }
}

/* ================= STOPWORDS ================= */

const stopwords = new Set([
  "the","a","an","how","what","why","is","are","does","do","can",
  "i","you","about","tell","me","please","explain","give","info"
]);

/* ================= KEYWORD OVERLAP ================= */

function keywordOverlap(a: string, b: string) {
  const tokensA = tokenize(a).filter(w => !stopwords.has(w));
  const tokensB = tokenize(b);

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let overlap = 0;

  for (const w of setA) {
    if (setB.has(w)) overlap++;
  }

  return overlap / Math.max(setA.size, 1);
}

/* ================= QUERY EXPANSION ================= */

async function expandQueryNeural(query: string): Promise<string[]> {
  const normalized = normalize(query);
  // One embedding request per user turn keeps retrieval responsive. Keyword
  // overlap remains part of ranking, so generic artificial expansions add
  // latency without adding useful evidence.
  return normalized ? [normalized] : [];
}

/* ================= MAIN RETRIEVAL ================= */

export async function getTopChunks(
  queryText: string,
  limit = 6,
  minSimilarity = 0.35 // FIX: lower threshold for stability
): Promise<{ text: string; source: string; score: number; intent: string }[]> {

  if (!queryText?.trim()) return [];

  const normalized = normalize(queryText);
  const queries = await expandQueryNeural(normalized);

  const embeddings: number[][] = new Array(queries.length);
  const missingIndices: number[] = [];
  const missingQueries: string[] = [];
  const missingKeys: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const cacheKey = normalize(queries[i]);
    const cached = queryEmbeddingCache.get(cacheKey);

    if (cached && cached.length === embeddingSize) {
      embeddings[i] = cached;
    } else {
      missingIndices.push(i);
      missingQueries.push(queries[i]);
      missingKeys.push(cacheKey);
    }
  }

  if (missingQueries.length > 0) {
    let generated: number[][] = [];

    try {
      generated = await getEmbeddingsBatch(missingQueries, {
        timeoutMs: 6500,
        fallbackToSingle: false,
      });
    } catch (err) {
      console.error("❌ Batch embedding generation failed; using keyword fallback:", err);
    }

    for (let i = 0; i < missingQueries.length; i++) {
      let embedding = generated[i];

      if (!Array.isArray(embedding) || embedding.length !== embeddingSize || embedding.some(value => !Number.isFinite(value))) {
        continue;
      }

      if (Array.isArray(embedding) && embedding.length === embeddingSize && embedding.every(Number.isFinite)) {
        embedding = normalizeVector(embedding);
        cacheEmbedding(missingKeys[i], embedding);
        embeddings[missingIndices[i]] = embedding;
      }
    }
  }

  const validEmbeddings = embeddings.filter(
    (embedding): embedding is number[] =>
      Array.isArray(embedding) &&
      embedding.length === embeddingSize &&
      embedding.every(Number.isFinite)
  );

  if (!cachedChunks.length) return [];

  if (!validEmbeddings.length) {
    const lexicalFallback = cachedChunks
      .map(chunk => ({ chunk, score: keywordOverlap(normalized, chunk.text) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ chunk, score }) => ({
        text: chunk.text.slice(0, 1400),
        source: chunk.source,
        score: Number(score.toFixed(4)),
        intent: chunk.intent,
      }));

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Vector Search] Embeddings unavailable; returned ${lexicalFallback.length} keyword matches.`);
    }
    return lexicalFallback;
  }

  const scored = cachedChunks.map(chunk => {
    let best = 0;

    for (const emb of validEmbeddings) {
      best = Math.max(best, cosineSimilarity(emb, chunk.embedding));
    }

    const keywordBoost = keywordOverlap(normalized, chunk.text);

    const intentBoost =
      chunk.intent && chunk.intent !== "general" &&
      normalized.includes(chunk.intent.replace(/_/g, " "))
        ? 0.08
        : 0;

    const hybridScore =
      best * 0.85 +
      keywordBoost * 0.10 +
      intentBoost;

    return {
      chunk,
      score: hybridScore
    };
  });

  scored.sort((a, b) => b.score - a.score);

  /* FIX: safer fallback instead of empty result */
  let filtered = scored.filter(s => s.score >= minSimilarity);

  if (!filtered.length) {
    filtered = scored.slice(0, Math.max(limit, 4));
    console.log("⚠️ Vector fallback activated (low similarity)");
  }

  const seen = new Set<string>();

const results: {
  text: string;
  source: string;
  score: number;
  intent: string;
}[] = [];

  for (const item of filtered) {
    const text = item.chunk.text.trim();
    if (!text || seen.has(text)) continue;

    seen.add(text);

    results.push({
      text: text.slice(0, 1400),
      source: item.chunk.source,
      score: Number(item.score.toFixed(4)),
      intent: item.chunk.intent
    });

    if (results.length >= limit) break;
  }

  console.log(
    `🧠 Vector search | Query="${normalized.slice(0, 40)}" | Results=${results.length}`
  );

  return results;
}
