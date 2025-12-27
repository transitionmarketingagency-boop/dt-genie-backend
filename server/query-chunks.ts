import sqlite3 from "sqlite3";
import { DB_PATH } from "./utils/dbPath"; // use canonical DB_PATH
import { getEmbedding } from "./services/embeddingClient.js";
import { cosineSimilarity } from "./utils/cosine.js";

/**
 * Open the canonical DB in read-only mode
 */
function openDB() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
}

/**
 * Fetch relevant chunks from the DB, ranked by cosine similarity to query
 */
export async function fetchRelevantChunks(query: string, limit = 5) {
  const db = openDB();
  const queryEmbedding = await getEmbedding(query);

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
              embedding: JSON.parse(r.embedding)
            }))
            .map(r => ({
              ...r,
              score: cosineSimilarity(queryEmbedding, r.embedding)
            }))
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

/**
 * Optional: Top-K test when running directly via `npx tsx`
 */
if (process.argv[1]?.endsWith("query-chunks.ts")) {
  (async () => {
    const chunks = await fetchRelevantChunks(
      "tell me about your services",
      3
    );
    console.log("\n ~M Top matching chunks:\n");
    chunks.forEach((c, i) => {
      console.log(`--- ${i + 1} (score: ${c.score.toFixed(4)}) ---`);
      console.log(c.content.slice(0, 300), "\n");
    });
  })().catch(console.error);
}

/**
 * ✅ No logic changes were made to your ranking/test code.
 * Only updated DB path to use DB_PATH from utils.
 */
