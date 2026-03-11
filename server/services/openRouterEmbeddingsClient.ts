// server/services/openRouterEmbeddingsClient.ts
import "dotenv/config";
import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY is not defined. Embeddings will fail.");
}

/* ================= RESPONSE TYPE ================= */
interface EmbeddingResponse {
  data?: {
    embedding?: number[];
  }[];
}

/* ================= EMBEDDING CACHE ================= */
const embeddingCache = new Map<string, number[]>();
const CACHE_LIMIT = 500;

function cacheEmbedding(key: string, embedding: number[]) {
  if (embeddingCache.size >= CACHE_LIMIT) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) embeddingCache.delete(firstKey);
  }
  embeddingCache.set(key, embedding);
}

/* ================= GET EMBEDDING ================= */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];

  const normalized = text.trim();

  // Return from cache if available
  if (embeddingCache.has(normalized)) {
    return embeddingCache.get(normalized)!;
  }

  const MAX_RETRIES = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen/Qwen3-Embedding-4B",
          input: normalized,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as EmbeddingResponse;
      const embedding = data?.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error("Invalid embedding response from OpenRouter");
      }

      const numericEmbedding = embedding.map(Number);

      // Cache result
      cacheEmbedding(normalized, numericEmbedding);

      return numericEmbedding;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Qwen embedding attempt ${attempt} failed:`, err);

      if (attempt <= MAX_RETRIES) {
        const delay = 2000 * attempt;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("❌ Failed to generate embedding after retries", lastError);
      }
    }
  }

  // Return empty embedding as fallback
  return [];
}

// Alias for legacy imports
export { getEmbedding as embedText };
