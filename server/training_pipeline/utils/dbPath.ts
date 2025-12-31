// server/training_pipeline/utils/dbPath.ts
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export absolute path to SQLite DB
export const DB_PATH = path.join(
  __dirname,
  "../../vector_store/unified_chunks.db"
);
