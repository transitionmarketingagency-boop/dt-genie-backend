import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";
import { pipeline } from "@xenova/transformers";

const DB_PATH = path.join(process.cwd(), "website_chunks.db");
const EMBEDDINGS_FILE = path.join(process.cwd(), "embeddings.json");

async function main() {
  console.log("🌐 Loading website chunks from DB...");

  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
  const chunks = [];

  db.each("SELECT id, url, content FROM chunks", (err, row) => {
    if (err) throw err;
    chunks.push(row);
  }, async () => {
    db.close();
    console.log(`✅ Loaded ${chunks.length} chunks`);

    console.log("🌐 Loading embedding model...");
    const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    const embeddings = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = await embedder(chunk.content, { pooling: "mean" });
      embeddings.push({
        id: chunk.id,
        url: chunk.url,
        content: chunk.content,
        vector: result.data[0],
      });
      if ((i+1) % 10 === 0) console.log(`Processed ${i+1}/${chunks.length} chunks`);
    }

    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
    console.log(`✅ Saved embeddings to ${EMBEDDINGS_FILE}`);
  });
}

main();
