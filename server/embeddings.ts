// server/embeddings.ts
import sqlite3 from "sqlite3";

export class VectorStore {
  db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  static async load(dbPath: string) {
    return new VectorStore(dbPath);
  }

  async query(question: string, topK: number = 3): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT content FROM chunks ORDER BY score DESC LIMIT ?`,
        [topK],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map((r) => r.content));
        }
      );
    });
  }
}
