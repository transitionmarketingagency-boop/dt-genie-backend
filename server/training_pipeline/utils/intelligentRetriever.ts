import sqlite3 from "sqlite3";
import { detectRole } from "../../services/roleRouter";
import { detectIntent } from "../chunker/intentDetector";
import { DB_PATH } from "../../utils/dbPath";

type RetrievedChunk = { content: string; metadata: any; score: number };

export async function intelligentRetrieve(query: string, topK = 6): Promise<RetrievedChunk[]> {
  const role = detectRole(query);
  const intent = detectIntent(query);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

    // NEW: read canonical embeddings table
    db.all(
      "SELECT section AS content, tags AS metadata FROM embeddings",
      [],
      (err, rows) => {
        if (err) { db.close(); return reject(err); }

        const ranked = rows
          .map((row: any) => {
            const meta = JSON.parse(row.metadata || '{}');
            let score = 0;
            if (meta.intent === intent) score += 3;
            if (meta.type === role) score += 2;
            if (meta.purpose?.includes(intent)) score += 1;
            return { content: row.content || row.section || '', metadata: meta, score };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        db.close();
        resolve(ranked);
      }
    );
  });
}
