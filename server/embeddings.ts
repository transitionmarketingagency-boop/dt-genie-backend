/**
 * Provides stable pseudo-embeddings for testing & similarity search
 */

export async function getEmbedding(text: string): Promise<number[]> {
  const vector: number[] = new Array(384).fill(0);
  for (let i = 0; i < text.length && i < 384; i++) {
    vector[i] = text.charCodeAt(i) / 255;
  }
  return vector;
}

export class VectorStore {
  async query(question: string, topK = 3): Promise<string[]> {
    // stub: returns empty array (replace with real vector DB later)
    return new Array(topK).fill("dummy content");
  }
}
