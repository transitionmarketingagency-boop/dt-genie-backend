// server/utils/rebuild_vector_store.js

import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const chunksPath = path.join(process.cwd(), "server/vector_store/chunks.json");
const dbPath = path.join(process.cwd(), "server/vector_store/vector_store.db");

// Backup existing DB first
if (fs.existsSync(dbPath)) {
  const backupPath = dbPath.replace(".db", `_backup_${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Existing DB backed up to ${backupPath}`);
}

async function main() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Create table
  await db.run(`
    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL
    )
  `);

  // Clear existing data to avoid duplicates
  await db.run(`DELETE FROM vectors`);

  // Load chunks
  if (!fs.existsSync(chunksPath)) {
    console.error("❌ chunks.json not found at", chunksPath);
    process.exit(1);
  }

  const rawChunks = fs.readFileSync(chunksPath, "utf-8");
  const chunks = JSON.parse(rawChunks);

  console.log(`📦 Loaded ${chunks.length} chunks from chunks.json`);

  const insertStmt = await db.prepare(`
    INSERT INTO vectors (file, chunk_index, text, embedding)
    VALUES (?, ?, ?, ?)
  `);

  for (const chunk of chunks) {
    if (!chunk.text || !chunk.embedding) continue;

    await insertStmt.run(
      chunk.file,
      chunk.chunk_index,
      chunk.text,
      JSON.stringify(chunk.embedding)
    );
  }

  await insertStmt.finalize();

  const rowCount = await db.get(`SELECT COUNT(*) as count FROM vectors`);
  console.log(`✅ Rebuild complete: ${rowCount.count} chunks inserted into vectors table`);

  await db.close();
}

main().catch((err) => {
  console.error("❌ Failed to rebuild vector_store:", err);
  process.exit(1);
});
