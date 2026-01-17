import path from "path";
import { fileURLToPath } from "url";

/**
 * Canonical DB path resolver
 * Works in:
 * - ts-node
 * - compiled dist/
 * - Render
 * - local dev
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// utils → server → project root
const SERVER_DIR = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(SERVER_DIR, "..");


export const DB_PATH = path.resolve(
  process.cwd(),
  "server",
  "vector_store",
  "unified_chunks.db"
);

export default DB_PATH;
