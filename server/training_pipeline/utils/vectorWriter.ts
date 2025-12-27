import sqlite3 from "sqlite3";
import { EmbeddedChunk } from "../embedder/embeddingTypes.js";

export function saveChunksToDB(
  chunks: EmbeddedChunk[],
  dbPath: string
) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        content TEXT,
        embedding TEXT,
        metadata TEXT
      )
    `);

    const stmt = db.prepare(
      "INSERT OR REPLACE INTO chunks VALUES (?, ?, ?, ?)"
    );

    for (const c of chunks) {
      stmt.run(
        c.id,
        c.content,
        JSON.stringify(c.embedding),
        JSON.stringify(c.metadata)
      );
    }

    stmt.finalize();
  });

  db.close();
}
