// server/queryChunks.js

import fs from "fs";
import path from "path";
import { getEmbedding } from "./services/embeddingClient.js";

const chunksPath = path.join(process.cwd(), "server", "vector_store", "chunks.json");

// Cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

export async function getTopChunks(queryText, limit = 6) {
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

  if (typeof queryText !== "string") queryText = String(queryText || "");
  if (!queryText.trim()) return [];

  let queryEmbedding;
  try {
    queryEmbedding = await getEmbedding(queryText);
  } catch (err) {
    console.error("Failed to generate query embedding:", err);
    return [];
  }

  const scored = [];

  for (const chunk of chunks) {
    if (!chunk?.embedding || !Array.isArray(chunk.embedding)) continue;

    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);

    if (similarity > 0.55) { // safe relevance threshold
      scored.push({ ...chunk, score: similarity });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
