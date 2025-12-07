// server/query-chunks.js
import sqlite3 from "sqlite3";

// Open DB helper
export function openDB() {
  return new sqlite3.Database("./website_chunks.db");
}

// Fetch top N relevant chunks (basic keyword match)
export async function fetchRelevantChunks(query, limit = 5) {
  const db = openDB();

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT page_url, heading, content
       FROM chunks
       WHERE content LIKE ?
       ORDER BY id ASC
       LIMIT ?`,
      [`%${query}%`, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
    db.close();
  });
}

