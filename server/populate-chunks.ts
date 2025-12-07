import fs from "fs";
import sqlite3 from "sqlite3";

// Open DB helper (sqlite3 directly)
function openDB() {
  return new sqlite3.Database("./server/website_chunks.db");
}

// Chunk text into smaller pieces
function chunkText(text: string, size = 1000) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

// ✅ Exported function to populate chunks
export async function populateChunks(): Promise<void> {
  const db = openDB();

  await new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Create table if not exists
      db.run(`
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          page_url TEXT,
          heading TEXT,
          content TEXT
        )
      `);

      // Read website content and chunk it
      const text = fs.readFileSync("./server/website_content.txt", "utf-8");
      const chunks = chunkText(text, 1000);

      // Clear existing data
      db.run("DELETE FROM chunks");

      // Insert chunks
      const stmt = db.prepare("INSERT INTO chunks (page_url, heading, content) VALUES (?, ?, ?)");
      for (const chunk of chunks) {
        stmt.run("", "", chunk);
      }
      stmt.finalize();

      console.log(`Inserted ${chunks.length} chunks into database.`);
      resolve();
    });
  });

  db.close();
}
