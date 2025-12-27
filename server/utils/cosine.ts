export function cosineSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b) return -1;

  if (a.length !== b.length) {
    throw new Error("Vector length mismatch");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return -1;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
