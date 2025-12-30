import crypto from "crypto";
import { getEmbedding } from "../../services/embeddingClient.js";
import { EmbeddedChunk } from "./embeddingTypes.js";

/**
 * Embeds a single content chunk using the active embedding provider.
 * Used by the chunking + ingestion pipeline.
 */
export async function embedChunk(chunk: {
  content: string;
  metadata: {
    type: string;
    source: string;
    intent: string;
    purpose: string;
  };
}): Promise<EmbeddedChunk> {
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
