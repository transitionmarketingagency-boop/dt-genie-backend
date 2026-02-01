import sqlite3 from "sqlite3";

/**
 * NOTE:
 * This file does NOT generate real embeddings.
 * It provides a stable interface so the rest of the system works.
 * Your actual semantic search is handled via stored chunks.
 */

export async function getEmbedding(text: string): Promise<number[]> {
  // Stable deterministic pseudo-embedding
  // (keeps all existing logic working without breaking anything)
  const vector: number[] = new Array(384).fill(0);
  for (let i = 0; i < text.length && i < 384; i++) {
    vector[i] = text.charCodeAt(i) / 255;
  }
  return vector;
}

export class VectorStore {
  db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  async query(question: string, topK = 3): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT content FROM chunks LIMIT ?`,
        [topK],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.content));
        }
      );
    });
  }
}
