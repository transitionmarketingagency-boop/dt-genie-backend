// server/db/vectorStore.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: any;

/* ---------------- DB singleton ---------------- */
export async function getDB() {
  if (!db) {
    db = await open({
      filename: join(__dirname, "../vector_store/unified_chunks.db"),
      driver: sqlite3.Database,
    });
  }
  return db;
}

/* ---------------- Cosine similarity (safe) ---------------- */
function cosineSimilarity(a: number[], b: number[]): number {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length === 0 ||
    b.length === 0 ||
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

/* ---------------- Retrieve relevant chunks ---------------- */
export async function getRelevantChunks(
  promptEmbedding: number[],
  limit = 10
) {
  if (!Array.isArray(promptEmbedding) || promptEmbedding.length === 0) {
    return [];
  }

  const db = await getDB();
  const rows = await db.all(`SELECT content, embedding FROM chunks`);

  const scored: { content: string; score: number }[] = [];

  for (const row of rows) {
    if (!row?.embedding || !row?.content) continue;

    let chunkEmbedding: number[];

    try {
      chunkEmbedding = JSON.parse(row.embedding);
      if (!Array.isArray(chunkEmbedding)) continue;
    } catch {
      continue;
    }

    const score = cosineSimilarity(promptEmbedding, chunkEmbedding);

    if (score > 0) {
      scored.push({
        content: row.content,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((r) => ({
    content: r.content,
  }));
}
