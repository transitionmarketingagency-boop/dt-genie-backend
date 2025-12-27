import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath";
import { getEmbedding } from "./services/embeddingClient.js";

const db = new sqlite3.Database(DB_PATH);

async function run() {
  console.log(" ~@ Embedding chunks...");

  db.all(
    "SELECT id, content FROM chunks WHERE embedding IS NULL",
    async (err, rows) => {
      if (err) throw err;

      console.log(`Found ${rows.length} chunks to embed`);

      for (const row of rows) {
        const vector = await getEmbedding(row.content);

        await new Promise<void>((resolve, reject) => {
          db.run(
            "UPDATE chunks SET embedding = ? WHERE id = ?",
            [JSON.stringify(vector), row.id],
            err => (err ? reject(err) : resolve())
          );
        });

        console.log(`✅ Embedded chunk ${row.id}`);
        await new Promise(res => setTimeout(res, 1200));
      }

      console.log(" ~I All chunks embedded successfully");
      db.close();
    }
  );
}

run().catch(err => {
  console.error("❌ Embedding failed:", err);
  db.close();
});
