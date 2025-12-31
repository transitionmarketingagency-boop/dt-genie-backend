import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

import { embedChunk } from "../embedder/embedChunk";
import { DB_PATH } from "../utils/dbPath";

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_PATH = path.join(process.cwd(), "server", "website_content.txt");
const CONCURRENCY = 5;

function chunkText(text: string, size = 1000) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

async function processChunk(
  stmt: sqlite3.Statement,
  chunkContent: string,
  idx: number
) {
  try {
    const embedded = await embedChunk({
      content: chunkContent,
      metadata: {
        type: "text",
        source: "website",
        intent: "general",
        purpose: "training",
      },
    });

    stmt.run("", "", chunkContent, JSON.stringify(embedded.embedding));
    console.log(`✅ Chunk ${idx + 1} embedded`);
  } catch (err) {
    console.error(`❌ Failed chunk ${idx + 1}`, err);
  }
}

export async function populateChunks(): Promise<void> {
  console.log("🚀 populateChunks started");
  console.log("DB path:", DB_PATH);

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
      const chunks = chunkText(text);

      db.run("DELETE FROM chunks");

      const stmt = db.prepare(
        "INSERT INTO chunks (page_url, heading, content, embedding) VALUES (?, ?, ?, ?)"
      );

      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((c, idx) => processChunk(stmt, c, i + idx)));
      }

      stmt.finalize(() => {
        console.log(`✅ Inserted ${chunks.length} chunks`);
        db.close();
        resolve();
      });
    });
  });
}

// Allow direct execution
if (process.argv[1]?.endsWith("populate-chunks.ts")) {
  populateChunks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
