// server/queryChunksWrapper.ts

import { getTopChunks } from "./queryChunks.js";

export type NormalizedChunk = {
  source: string;
  summary: string;
};

export async function fetchRelevantChunks(
  query: string,
  limit = 8
): Promise<NormalizedChunk[]> {

  // ⚠️ Production: embeddings retrieved externally
  const queryEmbedding: number[] = Array(512).fill(0); // placeholder, satisfies TS

  // ---------------- Retrieve top chunks
  const rawChunks = await getTopChunks(queryEmbedding, limit);
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
    // Drop empty / junk chunks
    .filter(c => c.source.length > 40)
    .slice(0, limit);

  // ~M DIAGNOSTIC LOGGING
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
