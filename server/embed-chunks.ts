import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath";
import { embedText } from "./services/embeddingClient";

const db = new sqlite3.Database(DB_PATH);

async function run() {
  console.log(" ~@ Embedding chunks...");

  db.all(
    "SELECT id, content FROM chunks WHERE embedding IS NULL",
    async (err, rows: any[]) => {
      if (err) throw err;

      for (const row of rows) {
        const vector = await embedText(String(row.content));

        await new Promise<void>((resolve, reject) => {
          db.run(
            "UPDATE chunks SET embedding = ? WHERE id = ?",
            [JSON.stringify(vector), row.id],
            err => (err ? reject(err) : resolve())
          );
        });

        console.log(`✅ Embedded chunk ${row.id}`);
      }

      db.close();
    }
  );
}

if (process.argv[1]?.includes("embed-chunks")) {
  run().catch(console.error);
}

