// server/db/vectorStore.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: any;

export async function getDB() {
  if (!db) {
    db = await open({
      filename: join(__dirname, "../vector_store/unified_chunks.db"),
      driver: sqlite3.Database,
    });
  }
  return db;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB + 1e-10);
}

export async function getRelevantChunks(promptEmbedding: number[], limit = 10) {
  const db = await getDB();
  const rows = await db.all(`SELECT content, embedding FROM chunks`);

  const scored = rows.map((row) => {
    const chunkEmbedding = JSON.parse(row.embedding);
    return { content: row.content, score: cosineSimilarity(promptEmbedding, chunkEmbedding) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((r) => ({ content: r.content }));
}

