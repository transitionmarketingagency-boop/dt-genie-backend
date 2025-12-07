import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open DB helper
export async function openDB() {
  return open({
    filename: "./website_chunks.db",
    driver: sqlite3.Database,
  });
}

// Fetch top N relevant chunks (basic keyword match)
export async function fetchRelevantChunks(query, limit = 5) {
  const db = await openDB();

  // Simple keyword search
  const rows = await db.all(
    `SELECT page_url, heading, content
     FROM chunks
     WHERE content LIKE ?
     ORDER BY id ASC
     LIMIT ?`,
    [`%${query}%`, limit]
  );

  await db.close();
  return rows;
}
