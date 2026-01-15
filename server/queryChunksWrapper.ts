import { getTopChunks } from "./queryChunks.js";
import { getPromptEmbedding } from "./system/identity.js";

export async function fetchRelevantChunks(query: string, limit = 5) {
  const embedding = await getPromptEmbedding(query);
  return getTopChunks(embedding, limit);
}
