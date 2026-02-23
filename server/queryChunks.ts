import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js"; // ✅ Correct ESM path

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const DEBUG = true;

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0) return 0;
  if (vecA.length !== vecB.length) {
    if (DEBUG) console.warn("Embedding dimension mismatch:", vecA.length, vecB.length);
    return 0;
  }
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getTopChunks(
  queryText: string,
  limit = 8,
  minSimilarity = 0.25
) {
  try {
    if (!fs.existsSync(chunksPath)) {
      console.warn("⚠️ chunks.json not found at", chunksPath);
      return [];
    }

    let chunks: { text: string; source?: string; embedding: number[] }[] = [];
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
    } catch (err) {
      console.error("⚠️ Invalid chunks.json format:", err);
      return [];
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      console.warn("⚠️ chunks.json is empty or invalid structure.");
      return [];
    }

    if (!queryText || !queryText.trim()) return [];

    const queryEmbedding = await getEmbedding(queryText);
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error("⚠️ Invalid query embedding.");
      return [];
    }

    const scored = chunks
      .filter(c => c && c.text && Array.isArray(c.embedding))
      .map(c => ({
        text: c.text,
        source: c.source || null,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score);

    if (DEBUG) {
      console.log(` M-" ${scored.length} chunks scored for query: "${queryText}"`);
      scored.slice(0, 5).forEach((c, i) => {
        console.log(`${i + 1}. Score=${c.score.toFixed(3)} | ${c.text.slice(0, 80)}...`);
      });
    }

    const filtered = scored.filter(c => c.score >= minSimilarity);
    return filtered.length > 0 ? filtered.slice(0, limit) : scored.slice(0, limit);

  } catch (err) {
    console.error("⚠️ Vector retrieval error:", err);
    return [];
  }
}
