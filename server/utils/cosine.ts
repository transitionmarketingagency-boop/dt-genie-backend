export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    // Pad the shorter vector with zeros
    const maxLength = Math.max(a.length, b.length);
    a = [...a, ...Array(maxLength - a.length).fill(0)];
    b = [...b, ...Array(maxLength - b.length).fill(0)];
  }

  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
