import sqlite3 from "sqlite3";

// server/services
import { getEmbedding } from "../../services/embeddingClient.ts";
import { detectRole } from "../../services/roleRouter.ts";

// server/utils
import { cosineSimilarity } from "../../utils/cosine.ts";
import { DB_PATH } from "../../utils/dbPath";

// training_pipeline/chunker
import { detectIntent } from "../chunker/intentDetector";

function openDB() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
}

export async function fetchRelevantChunks(query: string, limit = 6) {
  const db = openDB();
  const queryEmbedding = await getEmbedding(query);
  const intent = detectIntent(query);
  const role = detectRole(query);

  return new Promise<any[]>((resolve, reject) => {
    db.all(
      "SELECT id, page_url, heading, content, embedding FROM chunks",
      (err, rows: any[]) => {
        if (err) {
          db.close();
          return reject(err);
        }

        try {
          const ranked = rows
            .filter(r => r.embedding)
            .map(r => ({
              ...r,
              embedding: JSON.parse(r.embedding),
              metadata: r.metadata ? JSON.parse(r.metadata) : {}
            }))
            .map(r => {
              let score = cosineSimilarity(queryEmbedding, r.embedding);

              // metadata boost
              if (r.metadata.intent === intent) score += 0.3;
              if (r.metadata.type === role) score += 0.2;
              if (r.metadata.purpose?.includes(intent)) score += 0.1;

              return { ...r, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

          resolve(ranked);
        } catch (e) {
          reject(e);
        } finally {
          db.close();
        }
      }
    );
  });
}

// Direct test
if (process.argv[1]?.endsWith("query-chunks.ts")) {
  (async () => {
    const chunks = await fetchRelevantChunks("tell me about your services", 5);
    console.log("\n ~M Top matching chunks:\n");
    chunks.forEach((c, i) => {
      console.log(`--- ${i + 1} (score: ${c.score.toFixed(4)}) ---`);
      console.log(c.content.slice(0, 300), "\n");
    });
  })().catch(console.error);
}
