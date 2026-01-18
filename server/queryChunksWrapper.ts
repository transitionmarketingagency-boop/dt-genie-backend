// server/queryChunksWrapper.ts

import { getTopChunks } from "./queryChunks.js";
import { getPromptEmbedding } from "./system/identity.js";

export async function fetchRelevantChunks(query: string, limit = 5) {
  const embedding = await getPromptEmbedding(query);
  const rawChunks = await getTopChunks(embedding, limit);

  // Normalize chunks so downstream logic ALWAYS works
  return rawChunks.map((c: any) => ({
    source:
      c.content ||
      c.text ||
      c.metadata?.text ||
      c.metadata?.content ||
      "",
    summary:
      c.metadata?.summary ||
      c.content?.slice(0, 300) ||
      c.text?.slice(0, 300) ||
      ""
  }));
}
