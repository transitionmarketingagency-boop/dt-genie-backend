import { generateEmbedding } from "../../services/embeddingClient.js";
import { EmbeddedChunk } from "./embeddingTypes.js";
import crypto from "crypto";

export async function embedChunk(chunk: any): Promise<EmbeddedChunk> {
  const vector = await generateEmbedding(chunk.content);

  return {
    id: crypto.randomUUID(),
    content: chunk.content,
    embedding: vector,
    metadata: {
      ...chunk.metadata,
      createdAt: new Date().toISOString()
    }
  };
}
