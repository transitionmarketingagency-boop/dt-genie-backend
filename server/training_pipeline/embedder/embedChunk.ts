import crypto from "crypto";
import { getEmbedding } from "../../services/embeddingClient";

/**
 * Embeds a single content chunk
 */
export async function embedChunk(chunk: {
  content: string;
  metadata: {
    type: string;
    source: string;
    intent: string;
    purpose: string;
  };
}) {
  const vector = await getEmbedding(chunk.content);

  return {
    id: crypto.randomUUID(),
    content: chunk.content,
    embedding: vector,
    metadata: {
      ...chunk.metadata,
      createdAt: new Date().toISOString(),
    },
  };
}
