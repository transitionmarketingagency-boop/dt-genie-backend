// server/queryChunks.js

import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(
  process.cwd(),
  "server",
  "vector_store",
  "chunks.json"
);

// ================= COSINE SIMILARITY =================

function cosineSimilarity(vecA, vecB) {
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length !== vecB.length ||
    vecA.length === 0
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];

    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

// ================= MAIN RETRIEVAL =================

export async function getTopChunks(queryText, limit = 6) {
  try {
    if (!fs.existsSync(chunksPath)) {
      console.warn("chunks.json not found.");
      return [];
    }

    let chunks = [];

    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
    } catch (err) {
      console.error("Invalid chunks.json format:", err);
      return [];
    }

    if (typeof queryText !== "string") {
      queryText = String(queryText || "");
    }

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

    const MIN_SIMILARITY = 0.75; // safer production threshold
    const scored = [];

    for (const chunk of chunks) {
      if (
        !chunk ||
        !chunk.text ||
        !Array.isArray(chunk.embedding) ||
        chunk.embedding.length !== queryEmbedding.length
      ) {
        continue;
      }

      const similarity = cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      );

      if (similarity >= MIN_SIMILARITY) {
        scored.push({
          text: chunk.text,
          source: chunk.source || null,
          score: similarity,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  } catch (err) {
    console.error("Vector retrieval error:", err);
    return [];
  }
}
