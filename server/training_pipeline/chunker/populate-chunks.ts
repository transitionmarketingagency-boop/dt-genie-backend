// server/training_pipeline/chunker/populate-chunks.ts
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

// ✅ Correct DB path for ESM (works on Render)
import { DB_PATH } from "../utils/dbPath.js"; // <- fixed import for ESM
import { embedChunk } from "../embedder/embedChunk.js"; // <- fixed import for ESM

const CONTENT_PATH = path.join(process.cwd(), "server", "website_content.txt");
const CONCURRENCY = 5;

/**
 * Split text into chunks of a given size
 */
function chunkText(text: string, size = 1000) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

/**
 * Process a single chunk: generate embedding and insert into DB
 */
async function processChunk(
  stmt: sqlite3.Statement,
  chunkContent: string,
  idx: number
) {
  try {
    const embedded = await embedChunk({
      content: chunkContent,
      metadata: { type: "text", source: "website", intent: "general", purpose: "training" },
    });

    stmt.run("", "", chunkContent, JSON.stringify(embedded.embedding));
    console.log(`✅ Chunk ${idx + 1} embedded`);
  } catch (err) {
    console.error(`❌ Failed to embed chunk ${idx + 1}:`, err);
  }
}

/**
 * Populate DB with chunks and embeddings
 */
export async function populateChunks(): Promise<void> {
  console.log(" ~@ populateChunks() started");
  console.log("DB path:", DB_PATH);
  console.log("Content path:", CONTENT_PATH);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
    });

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
      const chunks = chunkText(text, 1000);
      console.log(`✂️ Chunked into ${chunks.length} pieces`);

      db.run("DELETE FROM chunks");

      const stmt = db.prepare(
        "INSERT INTO chunks (page_url, heading, content, embedding) VALUES (?, ?, ?, ?)"
      );

      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map((chunk, idx) => processChunk(stmt, chunk, i + idx))
        );
      }

      stmt.finalize((err) => {
        if (err) return reject(err);
        console.log(`✅ Inserted ${chunks.length} chunks with embeddings`);
        db.close(() => resolve());
      });
    });
  });
}

// Allow script execution directly
if (process.argv[1]?.endsWith("populate-chunks.ts")) {
  populateChunks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
