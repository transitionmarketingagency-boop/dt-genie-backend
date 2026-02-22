// server/queryChunks.js
import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const DEBUG = false;

// ================= COSINE SIMILARITY =================
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

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

// ================= MAIN RETRIEVAL =================
export async function getTopChunks(queryText, limit = 8, minSimilarity = 0.30) {
  try {
    if (!fs.existsSync(chunksPath)) {
      console.warn("chunks.json not found at", chunksPath);
      return [];
    }

    let chunks = [];
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
    } catch (err) {
      console.error("Invalid chunks.json format:", err);
      return [];
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      console.warn("chunks.json is empty or invalid structure.");
      return [];
    }

    if (typeof queryText !== "string") queryText = String(queryText || "");
    if (!queryText.trim()) return [];

    let queryEmbedding;
    try {
      queryEmbedding = await getEmbedding(queryText);
    } catch (err) {
      console.error("Failed to generate query embedding:", err);
      return [];
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error("Invalid query embedding.");
      return [];
    }

    const scored = chunks
      .filter(chunk => chunk && chunk.text && Array.isArray(chunk.embedding))
      .map(chunk => ({
        text: chunk.text,
        source: chunk.source || null,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [];

    const filtered = scored.filter(c => c.score >= minSimilarity);
    const result = filtered.length > 0 ? filtered.slice(0, limit) : scored.slice(0, limit);

    if (DEBUG && result.length > 0) {
      console.log("Top chunks retrieved:");
      result.slice(0, 5).forEach((c, i) =>
        console.log(`${i + 1}. Score=${c.score.toFixed(4)} | ${c.text.slice(0, 80)}...`)
      );
    }

    return result;
  } catch (err) {
    console.error("Vector retrieval error:", err);
    return [];
  }
}
