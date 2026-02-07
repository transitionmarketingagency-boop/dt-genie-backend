// server/queryChunks.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { DB_PATH } from "./utils/dbPath.js";

/* ---------------- Open SQLite database ---------------- */
export async function openDB() {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
}

/* ---------------- Cosine similarity ---------------- */
function cosineSim(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;

  const dot = vecA.reduce((sum, val, i) => sum + val * (vecB[i] || 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  return magA && magB ? dot / (magA * magB) : 0;
}

/* ---------------- Get top-N relevant chunks ---------------- */
export async function getTopChunks(queryEmbedding: number[], topN = 5) {
  const db = await openDB();

  // Pull everything (simple + safe for now)
  const rows = await db.all("SELECT * FROM embeddings");

  const parsedRows = rows.map((r: any) => {
    let embedding: number[] = [];

    try {
      embedding =
        typeof r.embedding === "string"
          ? JSON.parse(r.embedding)
          : Array.isArray(r.embedding)
          ? r.embedding
          : [];
    } catch {
      embedding = [];
    }

    // 🔑 THIS IS THE CRITICAL FIX
    const content =
      r.section ||
      r.source_file ||
      "";

    return {
      ...r,
      embedding,
      content,
    };
  });

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
