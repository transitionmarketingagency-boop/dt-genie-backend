import sqlite3 from "sqlite3";
import { EmbeddedChunk } from "../embedder/embeddingTypes.js";

export function saveChunksToDB(chunks: EmbeddedChunk[], dbPath: string) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        source_file TEXT,
        chunk_index INTEGER,
        embedding TEXT,
        section TEXT,
        tags TEXT,
        internal_only INTEGER DEFAULT 0
      )
    `);

    const stmt = db.prepare(
      "INSERT OR REPLACE INTO embeddings (id, source_file, chunk_index, embedding, section, tags, internal_only) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    for (const c of chunks) {
      stmt.run(
        c.id,
        c.source_file,
        c.chunk_index,
        JSON.stringify(c.embedding),
        c.section,
        c.tags,
        c.internal_only ?? 0
      );
    }

    stmt.finalize();
  });

  db.close();
}
