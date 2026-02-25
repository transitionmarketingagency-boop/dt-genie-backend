// server/testHybridSystem.ts
import { getEmbedding } from './services/embeddingClient.js';
import { cosineSimilarity } from './utils/cosine.js';

export async function loadPersona(name: string) {
  return { name, data: {} };
}

export async function createHybridResponse(prompt: string, persona: any) {
  // Get real embedding from Python backend
  const embedding = await getEmbedding(prompt);

  // Fallback: if embedding is empty, use zero vector
  const safeEmbedding = embedding.length > 0 ? embedding : new Array(384).fill(0);

  // Compute similarity against test vector
  const similarity = cosineSimilarity(safeEmbedding, [1, 0, 0]);
  return { text: `Response for "${prompt}"`, similarity };
}

// Standalone test
(async () => {
  const response = await createHybridResponse("Hello world", {});
  console.log("Hybrid response:", response);
})();
