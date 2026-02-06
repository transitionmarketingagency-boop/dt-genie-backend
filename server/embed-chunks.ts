import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath.js";

/**
 * ⚠️ LEGACY SCRIPT — SAFE-GUARDED
 * ----------------------------------
 * The project no longer uses a `chunks` table.
 * Embeddings are already stored in the `embeddings` table.
 * This script is disabled to prevent:
 * - accidental DB writes
 * - schema mismatch crashes
 * - wasted embedding API calls
 */

console.log("⚠️ embed-chunks.ts is deprecated and will not modify DB.");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Failed to connect to DB:", err.message);
    process.exit(1);
  }
});

// Confirm embeddings table exists and count embeddings
db.get("SELECT COUNT(*) as count FROM embeddings", (err, row: any) => {
  if (err) {
    console.error("❌ embeddings table not found:", err.message);
    db.close();
    process.exit(1);
  }

  console.log(`✅ Existing embeddings found: ${row.count}`);
  console.log(" ~Q Embedding process skipped (already complete).");

  db.close();
  process.exit(0);
});
