import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DB_PATH } from "../utils/dbPath.js";

/* ---------------- Singleton DB ---------------- */
let db: any;

export async function getDB() {
  if (!db) {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });
  }
  return db;
}

/* ---------------- Cosine similarity ---------------- */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

/* ---------------- Retrieve top relevant chunks ---------------- */
export async function getRelevantChunks(promptEmbedding: number[], limit = 10) {
  if (!Array.isArray(promptEmbedding) || !promptEmbedding.length) return [];
  const db = await getDB();
  const rows = await db.all("SELECT content, embedding FROM chunks");
  const scored: { content: string; score: number }[] = [];

  for (const row of rows) {
    if (!row?.embedding || !row?.content) continue;
    try {
      const chunkEmbedding: number[] = JSON.parse(row.embedding);
      if (!Array.isArray(chunkEmbedding)) continue;
      const score = cosineSimilarity(promptEmbedding, chunkEmbedding);
      if (score > 0) scored.push({ content: row.content, score });
    } catch {}
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(r => ({ content: r.content }));
}
