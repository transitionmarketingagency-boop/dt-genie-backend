// server/query-chunks.js
import sqlite3 from "sqlite3";
import path from "path";

// Open DB helper
export function openDB() {
  const dbPath = path.join(process.cwd(), "server/website_chunks.db");
  return new sqlite3.Database(dbPath);
}

// Fetch top N relevant chunks (flexible multi-keyword match)
export async function fetchRelevantChunks(query: string, limit = 5) {
  const db = openDB();

  // Split query into individual keywords (case-insensitive)
  const words = query.toLowerCase().match(/\w+/g) || [];
  if (words.length === 0) return [];

  // Flexible SQL: match any keyword (OR) rather than requiring all (AND)
  const conditions = words.map(() => "LOWER(content) LIKE ?").join(" OR ");
  const params = words.map(word => `%${word}%`);

  // SQLite LIMIT must be interpolated
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
      else resolve(rows);
    });
    db.close();
  });
}
