import sqlite3 from "sqlite3";
import { open } from "sqlite";

const EXISTING_DBS = [
  "./server/vector_store/website_chunks.db",
  "./server/server/website_chunks.db",
  "./recovery/db_backups/website_chunks.db"
  // Add more DB paths here if you have other embedded content (persona, sales, marketing, etc.)
];

const UNIFIED_DB = "./server/vector_store/unified_chunks.db";

async function mergeDBs() {
  const unifiedDb = await open({
    filename: UNIFIED_DB,
    driver: sqlite3.Database
  });

  for (const dbPath of EXISTING_DBS) {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    const rows = await db.all("SELECT * FROM chunks;");
    for (const row of rows) {
      // Insert rows and ignore duplicates
      await unifiedDb.run(
        `INSERT OR IGNORE INTO chunks (page_url, heading, content, embedding)
         VALUES (?, ?, ?, ?)`,
        row.page_url,
        row.heading,
        row.content,
        row.embedding
      );
    }
    await db.close();
    console.log(`Merged DB: ${dbPath}`);
  }

  await unifiedDb.close();
  console.log("✅ All DBs merged into unified_chunks.db");
}

mergeDBs();
