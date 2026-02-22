// server/queryChunks.js

import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const DEBUG = false; // set true to log top chunks

// ================= COSINE SIMILARITY =================
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0)
    return 0;

  const len = Math.max(vecA.length, vecB.length);
  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < len; i++) {
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
export async function getTopChunks(queryText, limit = 6, minSimilarity = 0.55) {
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

    // Generate query embedding
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

    // Score chunks
    const scored = chunks
      .filter(chunk => chunk && chunk.text && Array.isArray(chunk.embedding))
      .map(chunk => ({
        text: chunk.text,
        source: chunk.source || null,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      // Sort descending by similarity
      .sort((a, b) => b.score - a.score);

    // Fallback: if none meet minSimilarity, return top N anyway
    const filtered = scored.filter(c => c.score >= minSimilarity);
    const result = filtered.length > 0 ? filtered : scored.slice(0, limit);

    // Debug logging top chunks
    if (DEBUG && result.length > 0) {
      console.log("Top chunks:");
      result.slice(0, 3).forEach((c, i) =>
        console.log(`${i + 1}:`, c.text.slice(0, 100), "... Score:", c.score.toFixed(3))
      );
    }

    // Return limited chunks, or all if limit = 0
    return limit > 0 ? result.slice(0, limit) : result;
  } catch (err) {
    console.error("Vector retrieval error:", err);
    return [];
  }
}
