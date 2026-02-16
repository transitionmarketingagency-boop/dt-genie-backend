export async function generateEmbedding(text: string, length = 3): Promise<number[]> {
  // Mock embedding for deterministic test
  const vector = Array.from({ length }, (_, i) => (i + 1) / length);
  return vector;
}
