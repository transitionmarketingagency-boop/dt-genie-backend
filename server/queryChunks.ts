// server/queryChunks.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open DB connection
export async function openDB() {
  return open({
    filename: "./server/vector_store/unified_chunks.db",
    driver: sqlite3.Database,
  });
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSim(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, val, i) => sum + val * (vecB[i] || 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

/**
 * Get top N chunks from DB based on query embedding
 */
export async function getTopChunks(queryEmbedding: number[], topN = 5) {
  const db = await openDB();
  const rows = await db.all("SELECT * FROM chunks");

  // Parse embeddings from string to array
  const parsedRows = rows.map((r) => ({
    ...r,
    embedding: JSON.parse(r.embedding) as number[],
  }));

  // Compute similarity dynamically (no score column in DB)
  const ranked = parsedRows
    .map((r) => ({ ...r, score: cosineSim(queryEmbedding, r.embedding) }))
    .sort((a, b) => b.score - a.score) // highest similarity first
    .slice(0, topN);

  await db.close();
  return ranked;
}
