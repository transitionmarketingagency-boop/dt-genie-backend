import fs from "fs";

// Load embeddings
const embeddings = JSON.parse(fs.readFileSync("embeddings.json"));

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v*v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v*v, 0));
  return dot / (magA * magB);
}

// Query function
export function retrieveRelevantChunks(queryVector, topK = 3) {
  const scores = embeddings.map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.vector)
  }));

  return scores.sort((a,b) => b.score - a.score).slice(0, topK);
}
