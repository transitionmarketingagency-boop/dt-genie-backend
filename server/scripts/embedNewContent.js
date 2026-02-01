import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import { DB_PATH } from "../utils/dbPath.js";
import { embedText } from "../services/embeddingService.js"; // your existing embedding function

/* ---------------- Open SQLite DB ---------------- */
async function openDB() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
  return db;
}

/* ---------------- Ensure chunks table exists ---------------- */
async function initChunksTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT,
      chunk_index INTEGER,
      embedding TEXT,
      section TEXT,
      tags TEXT,
      internal_only INTEGER DEFAULT 0
    )
  `);
  console.log("✅ Chunks table checked/created.");
}

/* ---------------- Read new content files ---------------- */
function getNewFiles(dir, ext = ".md") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(ext)).map(f => path.join(dir, f));
}

/* ---------------- Embed content ---------------- */
async function embedFile(db, filePath, section = "", tags = "") {
  const content = fs.readFileSync(filePath, "utf-8");
  const chunks = content.match(/(.|[\r\n]){1,1000}/g) || []; // split by ~1000 chars per chunk
  for (let i = 0; i < chunks.length; i++) {
    const textChunk = chunks[i];
    const embedding = await embedText(textChunk); // returns number[]
    await db.run(
      `INSERT INTO chunks (source_file, chunk_index, embedding, section, tags) VALUES (?, ?, ?, ?, ?)`,
      [filePath, i, JSON.stringify(embedding), section, tags]
    );
    console.log(`✅ Embedded chunk ${i} from ${filePath}`);
  }
}

/* ---------------- MAIN ---------------- */
async function main() {
  const db = await openDB();
  await initChunksTable(db);

  // Example: embed ai_marketing_overview.md
  const newFilesDir = path.join(process.cwd(), "server/knowledge_base/08_ai_marketing");
  const files = getNewFiles(newFilesDir);

  for (const f of files) {
    await embedFile(db, f, "08_ai_marketing", "ai_marketing");
  }

  await db.close();
  console.log("🎯 All new content embedded successfully.");
}

main().catch(err => {
  console.error("❌ Embedding failed:", err);
});
