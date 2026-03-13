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

console.log("📚 Loading vector chunks from:", chunksPath);

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
  "stability ai"
];

/* ================= VECTOR NORMALIZATION ================= */

function normalizeVector(vec: number[]) {

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

        const cleanText = String(c.text).trim();

        let embedding = c.embedding
          .map(Number)
          .filter((n: number) => !Number.isNaN(n));

        embedding = normalizeVector(embedding);

        return {
          text: cleanText,
          source:
            typeof c.source === "string" && c.source.trim()
              ? c.source
              : "Digital Transition Marketing",
          embedding,
          intent:
            typeof c.intent === "string" && c.intent.trim()
              ? c.intent
              : "general"
        };

      })
      .filter((c: Chunk) =>
        c.embedding.length > 100 &&
        c.text.length > 40 &&
        !blockedPlatforms.some(p =>
          c.text.toLowerCase().includes(p)
        )
      );

    if (cachedChunks.length > 0) {
      embeddingSize = cachedChunks[0].embedding.length;
    }

    cachedChunks = cachedChunks.filter(
      c => c.embedding.length === embeddingSize
    );

    console.log(`✅ ${cachedChunks.length} chunks loaded`);
    console.log(`📐 Embedding dimension: ${embeddingSize}`);

  } catch (err) {

    console.error("❌ Failed to load chunks:", err);

  }

})();

/* ================= VECTOR MATH ================= */

function cosineSimilarity(vecA: number[], vecB: number[]): number {

  if (!vecA || !vecB) return 0;

  if (vecA.length !== vecB.length) return 0;

  let dot = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }

  return dot;

}

/* ================= QUERY CACHE ================= */

const queryEmbeddingCache = new Map<string, number[]>();
const CACHE_LIMIT = 200;

function cacheEmbedding(key: string, embedding: number[]) {

  if (queryEmbeddingCache.has(key)) {
    queryEmbeddingCache.delete(key);
  }

  queryEmbeddingCache.set(key, embedding);

  if (queryEmbeddingCache.size > CACHE_LIMIT) {

    const first = queryEmbeddingCache.keys().next().value;

    if (first !== undefined) {
      queryEmbeddingCache.delete(first);
    }

  }

}

/* ================= STOPWORDS ================= */

const stopwords = new Set([
  "the","a","an","how","what","why","is","are","does","do","can","i","you","about"
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

/* ================= MAIN RETRIEVAL ================= */

export async function getTopChunks(
  queryText: string,
  limit = 6,
  minSimilarity = 0.55
): Promise<{ text: string; source: string; score: number; intent: string }[]> {

  if (!queryText?.trim()) return [];

  const normalized = normalize(queryText);

  /* ================= MULTI QUERY ================= */

  const queries = [
    normalized,
    `${normalized} marketing`,
    `${normalized} service`,
    `${normalized} digital marketing`
  ];

  const allEmbeddings: number[][] = [];

  for (const q of queries) {

    let embedding = queryEmbeddingCache.get(q);

    if (!embedding) {

      try {

        embedding = await getQwenEmbedding(q);

        if (!embedding?.length) continue;

        embedding = normalizeVector(embedding);

        cacheEmbedding(q, embedding);

      } catch (err) {

        console.error("❌ Embedding generation failed:", err);
        continue;

      }

    }

    if (embedding.length === embeddingSize) {
      allEmbeddings.push(embedding);
    }

  }

  if (!allEmbeddings.length) return [];

  /* ================= SCORE CHUNKS ================= */

  const scored = cachedChunks.map(chunk => {

    let bestScore = 0;

    for (const emb of allEmbeddings) {

      const semantic = cosineSimilarity(emb, chunk.embedding);

      if (semantic > bestScore) bestScore = semantic;

    }

    const keywordBoost = keywordOverlap(normalized, chunk.text);

    let intentBoost = 0;

    if (chunk.intent && chunk.intent !== "general") {

      const intentTokens = tokenize(chunk.intent.replace(/_/g, " "));

      for (const t of intentTokens) {

        if (normalized.includes(t)) {
          intentBoost = 0.08;
          break;
        }

      }

    }

    const hybridScore =
      bestScore * 0.82 +
      keywordBoost * 0.13 +
      intentBoost;

    return {
      chunk,
      score: hybridScore
    };

  });

  /* ================= SORT ================= */

  scored.sort((a, b) => b.score - a.score);

  /* ================= FILTER ================= */

  let filtered = scored.filter(s => s.score >= minSimilarity);

  if (!filtered.length) {

    filtered = scored.slice(0, Math.max(limit, 4));

    console.log("⚠️ Vector fallback activated");

  }

  /* ================= DIVERSITY ================= */

  const seenTexts = new Set<string>();

  const results: {
    text: string;
    source: string;
    score: number;
    intent: string;
  }[] = [];

  for (const item of filtered) {

    const text = item.chunk.text.trim();

    if (!text || seenTexts.has(text)) continue;

    seenTexts.add(text);

    results.push({
      text: text.slice(0, 1400),
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
