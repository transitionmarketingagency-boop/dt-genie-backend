import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath.js";
import { embedText } from "./services/embeddingClient.js";

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) throw err;
  console.log("✅ Connected to DB");
});

async function run() {
  console.log(" ~@ Embedding chunks...");
  db.serialize(() => {
    db.all("SELECT id, content FROM chunks WHERE embedding IS NULL", async (err, rows: any[]) => {
      if (err) { db.close(); throw err; }

      for (const row of rows) {
        const vector = await embedText(String(row.content));
        await new Promise<void>((resolve, reject) => {
          db.run(
            "UPDATE chunks SET embedding = ? WHERE id = ?",
            [JSON.stringify(vector), row.id],
            (err) => (err ? reject(err) : resolve())
          );
        });
        console.log(`✅ Embedded chunk ${row.id}`);
      }
      db.close();
    });
  });
}

if (process.argv[1]?.includes("embed-chunks")) run().catch(console.error);
