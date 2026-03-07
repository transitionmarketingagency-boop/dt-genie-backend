// server/services/openRouterEmbeddingsClient.ts
import "dotenv/config";
import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.warn("⚠️ OPENROUTER_API_KEY is not defined. Cloud embeddings will fail.");
}

interface EmbeddingResponse {
  data?: {
    embedding?: number[];
  }[];
}

/**
 * Get text embeddings using OpenRouter Qwen 4B embedding model
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen/Qwen3-Embedding-4B", // 4B model
          input: text,
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

      return embedding.map(Number); // ensure numeric array
    } catch (err) {
      console.warn(`⚠️ Qwen embedding attempt ${attempt} failed:`, err);
      if (attempt > MAX_RETRIES) break;
      await new Promise((res) => setTimeout(res, 2000 * attempt)); // exponential backoff
    }
  }

  console.error("❌ Failed to generate embedding after retries");
  return [];
}

// Alias for legacy imports
export { getEmbedding as embedText };
