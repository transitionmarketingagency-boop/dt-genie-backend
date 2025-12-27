import path from "path";

/**
 * ✅ Canonical unified database path
 */
export const DB_PATH = path.resolve(
  process.cwd(),
  "server",
  "vector_store",
  "unified_chunks.db"
);
