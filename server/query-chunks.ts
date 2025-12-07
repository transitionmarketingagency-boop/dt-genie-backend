// server/query-chunks.ts
import sqlite3 from "sqlite3";
import path from "path";

export interface ChunkRow {
  page_url: string;
  heading: string;
  content: string;
}

export function openDB() {
  const dbPath = path.join(process.cwd(), "server/website_chunks.db");
  return new sqlite3.Database(dbPath);
}

export async function fetchRelevantChunks(query: string, limit = 5): Promise<ChunkRow[]> {
  const db = openDB();
  const words = query.toLowerCase().match(/\w+/g) || [];
  if (words.length === 0) return [];

  const conditions = words.map(() => "LOWER(content) LIKE ?").join(" AND ");
  const params = words.map(word => `%${word}%`);

  const sql = `
    SELECT page_url, heading, content
    FROM chunks
    WHERE ${conditions}
    ORDER BY id ASC
    LIMIT ${limit}
  `;

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as ChunkRow[]);
    });
    db.close();
  });
}
