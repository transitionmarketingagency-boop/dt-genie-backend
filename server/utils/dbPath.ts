// server/utils/dbPath.ts
import path from "path";

/**
 * SQLite unified database path
 */
export const DB_PATH = path.resolve(
  process.cwd(),
  "server",
  "vector_store",
  "unified_chunks.db"
);

/**
 * JSON embeddings file path
 */
export const EMBEDDINGS_PATH = path.resolve(
  process.cwd(),
  "server",
  "vector_store",
  "embeddings.json"
);
