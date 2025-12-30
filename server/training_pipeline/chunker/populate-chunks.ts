// server/training_pipeline/chunker/populate-chunks.ts

import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

// ✅ Correct relative paths from /chunker/
import { DB_PATH } from "../utils/dbPath.js";
import { embedChunk } from "../embedder/embedChunk.js";

// ------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_PATH = path.join(
  process.cwd(),
  "server",
  "website_content.txt"
);

const CONCURRENCY = 5;

// ------------------------------------------------------------------

function chunkText(text: string, size = 1000): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

// ------------------------------------------------------------------

async function processChunk(
  stmt: sqlite3.Statement,
  chunk: string,
  index: number
) {
  try {
    const embedding = await embedChunk(chunk);
    stmt.run("", "", chunk, JSON.stringify(embedding));
    console.log(`✅ Chunk ${index + 1} embedded`);
  } catch (err) {
    console.error(`❌ Failed to embed chunk ${index + 1}:`, err);
  }
}

// ------------------------------------------------------------------

export async function populateChunks(): Promise<void> {
  console.log("🚀 Starting chunk population...");
  console.log("DB Path:", DB_PATH);
  console.log("Content Path:", CONTENT_PATH);

  const db = new sqlite3.Database(DB_PATH);

  await new Promise<void>((resolve, reject) => {
    db.serialize(async () => {
      db.run(`
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          page_url TEXT,
          heading TEXT,
          content TEXT,
          embedding TEXT
        )
      `);

      const text = fs.readFileSync(CONTENT_PATH, "utf-8");
      const chunks = chunkText(text);

      console.log(`✂️  Chunked into ${chunks.length} parts`);

      const stmt = db.prepare(
        "INSERT INTO chunks (page_url, heading, content, embedding) VALUES (?, ?, ?, ?)"
      );

      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map((chunk, idx) =>
            processChunk(stmt, chunk, i + idx)
          )
        );
      }

      stmt.finalize(err => {
        if (err) return reject(err);
        console.log("✅ All chunks inserted successfully");
        db.close(() => resolve());
      });
    });
  });
}

// ------------------------------------------------------------------
// CLI execution
if (process.argv[1]?.endsWith("populate-chunks.ts")) {
  populateChunks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
