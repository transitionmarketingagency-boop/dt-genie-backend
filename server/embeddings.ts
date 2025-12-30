import sqlite3 from "sqlite3";

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
