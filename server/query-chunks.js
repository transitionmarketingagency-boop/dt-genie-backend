// server/query-chunks.js
import sqlite3 from "sqlite3";

// Type for chunk rows
export interface Chunk {
  page_url: string;
  heading: string;
  content: string;
}

// Open DB helper
export function openDB() {
  return new sqlite3.Database("./website_chunks.db");
}

// Fetch top N relevant chunks (basic keyword match)
export async function fetchRelevantChunks(query: string, limit = 5): Promise<Chunk[]> {
  const db = openDB();

  return new Promise<Chunk[]>((resolve, reject) => {
    db.all(
      `SELECT page_url, heading, content
       FROM chunks
       WHERE content LIKE ?
       ORDER BY id ASC
       LIMIT ?`,
      [`%${query}%`, limit],
      (err, rows: Chunk[]) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
    db.close();
  });
}
