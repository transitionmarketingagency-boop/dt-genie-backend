import path from "path";
import { fileURLToPath } from "url";

// Convert ES module URL to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SINGLE SOURCE OF TRUTH
 * This path MUST exist in both dev and prod
 */
export const DB_PATH = path.resolve(
  __dirname,
  "../vector_store/unified_chunks.db"
);

console.log("✅ DB_PATH resolved:", DB_PATH);
