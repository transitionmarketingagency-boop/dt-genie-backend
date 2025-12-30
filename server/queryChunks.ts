// server/queryChunks.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

// ✅ IMPORTANT: absolute DB path (works in Render)
const DB_PATH = path.join(process.cwd(), "server/vector_store/unified_chunks.db");

// Open SQLite database
export async function openDB() {
  return open({
    filename: DB_PATH,
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
 * Fetch top-N chunks using cosine similarity
 */
export async function getTopChunks(queryEmbedding: number[], topN = 5) {
  const db = await openDB();

  const rows = await db.all("SELECT * FROM chunks");

  const parsedRows = rows.map((r: any) => ({
    ...r,
    embedding: JSON.parse(r.embedding),
  }));

  const ranked = parsedRows
    .map((r: any) => ({
      ...r,
      score: cosineSim(queryEmbedding, r.embedding),
    }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topN);

  await db.close();
  return ranked;
}
