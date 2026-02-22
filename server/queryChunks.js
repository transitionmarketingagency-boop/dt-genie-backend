// server/queryChunks.js

import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");
const DEBUG = false; // set true to log top chunks for debugging

// ================= COSINE SIMILARITY =================
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;

  // Pad shorter vector with zeros
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
    const scored = [];
    for (const chunk of chunks) {
      if (!chunk || !chunk.text || !Array.isArray(chunk.embedding)) continue;

      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);

      if (similarity >= minSimilarity) {
        scored.push({
          text: chunk.text,
          source: chunk.source || null,
          score: similarity,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    if (DEBUG && scored.length > 0) {
      console.log("Top chunk:", scored[0].text.slice(0, 100), "...", "Score:", scored[0].score.toFixed(3));
    }

    // Handle limit = 0 as "no limit"
    return limit > 0 ? scored.slice(0, limit) : scored;
  } catch (err) {
    console.error("Vector retrieval error:", err);
    return [];
  }
}
