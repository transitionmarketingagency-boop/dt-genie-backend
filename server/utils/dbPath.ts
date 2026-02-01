import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Database from "better-sqlite3";
import fs from "fs";

/**
 * Canonical DB path resolver
 * Works in:
 * - compiled dist/
 * - NodeNext / ESM
 * - local dev
 * - production (Render)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Canonical embeddings DB
 * Always points to the real vector store
 */
export const DB_PATH = resolve(
  process.cwd(),
  "server",
  "vector_store",
  "vector_store.db"
);

/* ------------------------------------------------------------------ */
/* SAFETY: ensure folder exists (Render cold start fix)                */
/* ------------------------------------------------------------------ */
const dbDir = resolve(process.cwd(), "server", "vector_store");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/* ------------------------------------------------------------------ */
/* SAFETY: ensure embeddings table exists (NO data loss)               */
/* ------------------------------------------------------------------ */
const db = new Database(DB_PATH);

db.prepare(`
  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    source TEXT,
    metadata TEXT
  )
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_embeddings_source
  ON embeddings (source)
`).run();

/* ------------------------------------------------------------------ */
/* Do NOT close DB — reused by runtime                                 */
/* ------------------------------------------------------------------ */

export default DB_PATH;
