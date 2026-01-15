import sqlite3 from "sqlite3";

// ✅ FIXED imports (removed .ts extensions)
import { getEmbedding } from "../../services/embeddingClient";
import { detectRole } from "../../services/roleRouter";
import { cosineSimilarity } from "../../utils/cosine";
import { DB_PATH } from "../../utils/dbPath";

// Open DB
function openDB() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
}

export async function fetchRelevantChunks(query: string, limit = 6) {
  const db = openDB();
  const queryEmbedding = await getEmbedding(query);
  const intent = detectRole(query);

  return new Promise<any[]>((resolve, reject) => {
    db.all(
      "SELECT id, page_url, heading, content, embedding, metadata FROM chunks",
      (err, rows: any[]) => {
        if (err) {
          db.close();
          return reject(err);
        }

        try {
          const ranked = rows
            .filter(r => r.embedding)
            .map(r => {
              const embedding = JSON.parse(r.embedding);
              const metadata = r.metadata ? JSON.parse(r.metadata) : {};

              let score = cosineSimilarity(queryEmbedding, embedding);

              if (metadata.intent === intent) score += 0.3;
              if (metadata.type === intent) score += 0.2;
              if (metadata.purpose?.includes(intent)) score += 0.1;

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

// Manual test
if (process.argv[1]?.endsWith("query-chunks.ts")) {
  (async () => {
    const chunks = await fetchRelevantChunks("tell me about your services", 5);
    console.log("\n🔍 Top Matching Chunks:\n");
    chunks.forEach((c, i) => {
      console.log(`--- ${i + 1} (score: ${c.score.toFixed(4)}) ---`);
      console.log(c.content.slice(0, 300), "\n");
    });
  })().catch(console.error);
}
