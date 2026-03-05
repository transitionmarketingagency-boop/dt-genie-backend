import { getTopChunks } from "./queryChunks.js"; // ✅ ESM-safe
import { getEmbedding } from "./services/openRouterEmbeddingsClient.js";
export type NormalizedChunk = {
  source: string;
  summary: string;
};

export async function fetchRelevantChunks(
  query: string,
  limit = 8
): Promise<NormalizedChunk[]> {

  if (!query || !query.trim()) return [];

  const queryEmbedding: number[] = await getEmbedding(query);

  const rawChunks = await getTopChunks(query, limit);
  if (!Array.isArray(rawChunks)) return [];

  const normalized = rawChunks
    .map((c: any) => {
      const source =
        c?.content ||
        c?.text ||
        c?.metadata?.content ||
        c?.metadata?.text ||
        "";

      return {
        source: source.trim(),
        summary: source.slice(0, 240)
      };
    })
    .filter(c => c.source.length > 40)
    .slice(0, limit);

  console.log(" M-) Retrieved Chunks:");
  if (normalized.length === 0) {
    console.log("⚠️ No relevant chunks found");
  } else {
    normalized.forEach((c, i) => {
      console.log(
        `#${i + 1}:`,
        c.source.slice(0, 140).replace(/\n/g, " ")
      );
    });
  }

  return normalized;
}
