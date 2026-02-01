import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

/**
 * Canonical DB path resolver
 * Works in:
 * - compiled dist/
 * - NodeNext / ESM
 * - local dev
 * - production
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Canonical embeddings DB
 * Always points to the real vector store (418 embeddings)
 */
export const DB_PATH = resolve(
  process.cwd(),
  "server",
  "vector_store",
  "vector_store.db"
);

export default DB_PATH;
