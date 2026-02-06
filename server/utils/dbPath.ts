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
/* Open DB (do NOT mutate schema incorrectly)                          */
/* ------------------------------------------------------------------ */
const db = new Database(DB_PATH);

/* ------------------------------------------------------------------ */
/* SAFETY: ensure REAL embeddings table exists (schema-aligned)        */
/* ------------------------------------------------------------------ */
/**
 * IMPORTANT:
 * This matches the ACTUAL schema used by your embedding pipeline.
 * No data loss. No schema drift.
 */
db.prepare(`
  CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file TEXT,
    chunk_index INTEGER,
    embedding TEXT,
    section TEXT,
    tags TEXT,
    internal_only INTEGER
  )
`).run();

/* ------------------------------------------------------------------ */
/* SAFE indexes (only on existing columns)                             */
/* ------------------------------------------------------------------ */
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_source_chunk
  ON embeddings (source_file, chunk_index)
`).run();

/* ------------------------------------------------------------------ */
/* Do NOT close DB — reused by runtime                                 */
/* ------------------------------------------------------------------ */

export default DB_PATH;
