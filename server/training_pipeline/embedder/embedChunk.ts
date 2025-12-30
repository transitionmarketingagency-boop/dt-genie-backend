import { getEmbedding } from "../../services/embeddingClient";
import { EmbeddedChunk } from "./embeddingTypes";
import crypto from "crypto";

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
