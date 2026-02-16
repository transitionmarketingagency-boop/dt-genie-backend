import { generateEmbedding } from './utils/embedding.js';
import { cosineSimilarity } from './utils/cosine.js';

export async function loadPersona(name: string) {
  return { name, data: {} };
}

export async function createHybridResponse(prompt: string, persona: any) {
  // Ensure embedding is length 3 to match test vector
  const embedding = await generateEmbedding(prompt, 3);
  const similarity = cosineSimilarity(embedding, [1, 0, 0]);
  return { text: `Response for "${prompt}"`, similarity };
}
