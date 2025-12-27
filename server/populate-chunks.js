// server/populate-chunks.js
import fs from "fs";
import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath";

// Open canonical DB
function openDB() {
  return new sqlite3.Database(DB_PATH);
}

// Chunk text into smaller pieces
function chunkText(text, size = 1000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

export function populateChunks() {
  const db = openDB();

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        page_url TEXT,
        heading TEXT,
        content TEXT
      )
    `);

    const text = fs.readFileSync("./server/website_content.txt", "utf-8");
    const chunks = chunkText(text, 1000);

    const stmt = db.prepare(
      "INSERT INTO chunks (page_url, heading, content) VALUES (?, ?, ?)"
    );

    for (const chunk of chunks) {
      stmt.run("", "", chunk);
    }

    stmt.finalize();
    console.log(`Inserted ${chunks.length} chunks into database.`);
  });

  db.close();
}

// ES module entry
if (import.meta.url === `file://${process.cwd()}/server/populate-chunks.js`) {
  populateChunks();
}
