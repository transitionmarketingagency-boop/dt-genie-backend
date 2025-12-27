// server/embed-chunks.ts
import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath";
import { embedText } from "./services/embeddingClient.js";

const db = new sqlite3.Database(DB_PATH);

async function run() {
  console.log(" ~@ Embedding chunks...");

  db.all(
    "SELECT id, content FROM chunks WHERE embedding IS NULL",
    async (err, rows) => {
      if (err) throw err;

      console.log(`Found ${rows.length} chunks to embed`);

      for (const row of rows) {
        const vector = await embedText(row.content);

        await new Promise<void>((resolve, reject) => {
          db.run(
            "UPDATE chunks SET embedding = ? WHERE id = ?",
            [JSON.stringify(vector), row.id],
            err => (err ? reject(err) : resolve())
          );
        });

        console.log(`✅ Embedded chunk ${row.id}`);

        // ⏳ throttle (IMPORTANT for free tier)
        await new Promise(res => setTimeout(res, 1200));
      }

      db.close();
    }
  );
}

if (process.argv[1]?.endsWith("embed-chunks.ts")) {
  run().catch(console.error);
}
