import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

const DB_DIR = path.join(process.cwd(), "server/vector_store");
const DB_PATH = path.join(DB_DIR, "unified_chunks.db");

export function initDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new sqlite3.Database(DB_PATH);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        embedding TEXT,
        metadata TEXT
      )
    `);
  });

  return db;
}
