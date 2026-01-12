const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";

// Simple mock embeddings for testing when API is not available
function generateMockEmbedding(text: string): number[] {
  // Generate consistent mock embeddings based on text hash
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const random = Math.sin(hash) * 10000;
  const seeded = random - Math.floor(random);

  // Create 384-dimensional embedding (same as MiniLM)
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    const value = Math.sin(hash + i * 0.1) * Math.cos(seeded + i * 0.2);
    embedding.push(value);
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? embedding.map(v => v / norm) : embedding;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return generateMockEmbedding("");
  }

  // Use HuggingFace API if available
  if (HUGGINGFACE_API_KEY) {
    try {
      const response = await fetch("https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text.substring(0, 512) }),
      });

      if (response.ok) {
        const result = await response.json();
        if (Array.isArray(result) && Array.isArray(result[0])) {
          return result[0] as number[];
        }
      }
    } catch (error) {
      console.warn("Embedding API error, using mock:", error instanceof Error ? error.message : "");
    }
  }

  // Fallback to mock embeddings
  return generateMockEmbedding(text);
}

export function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentences
        .slice(Math.max(0, sentences.indexOf(sentence) - Math.floor(overlap / 50)), sentences.indexOf(sentence))
        .join(".")
        .trim();
    }
    currentChunk += (currentChunk ? " " : "") + sentence;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}
