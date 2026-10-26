// server/services/openRouterEmbeddingsClient.ts
import "dotenv/config";

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
  const REQUEST_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS) || 12000;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
        signal: controller.signal,
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
    } catch (err: any) {
      lastError = err;
      const message =
        err?.name === "AbortError"
          ? `request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : err?.message || String(err);

      console.warn(`⚠️ Qwen embedding attempt ${attempt} failed: ${message}`);

      if (attempt <= MAX_RETRIES) {
        const delay = 2000 * attempt;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("❌ Failed to generate embedding after retries", message);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  // Return empty embedding as fallback
  return [];
}


/* ================= BATCH GET EMBEDDINGS ================= */
export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const results: (number[] | undefined)[] = new Array(texts.length);
  const missingByKey = new Map<string, number[]>();

  // Preserve input order and reuse the existing cache.
  texts.forEach((text, index) => {
    const key = typeof text === "string" ? text.trim() : "";

    if (!key) {
      results[index] = [];
      return;
    }

    const cached = embeddingCache.get(key);
    if (cached) {
      results[index] = cached;
      return;
    }

    const positions = missingByKey.get(key) ?? [];
    positions.push(index);
    missingByKey.set(key, positions);
  });

  const missingTexts = [...missingByKey.keys()];
  if (missingTexts.length === 0) return results.map(embedding => embedding ?? []);

  const REQUEST_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS) || 12000;

  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not defined");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen/Qwen3-Embedding-4B",
          input: missingTexts,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
      }

      const payload = await res.json() as {
        data?: { index?: number; embedding?: number[] }[];
      };

      const data = payload.data;
      if (!Array.isArray(data) || data.length !== missingTexts.length) {
        throw new Error("Batch response count does not match input count");
      }

      const ordered: (number[] | undefined)[] = new Array(missingTexts.length);
      for (const item of data) {
        if (!Number.isInteger(item.index) ||
            item.index! < 0 ||
            item.index! >= missingTexts.length ||
            !Array.isArray(item.embedding)) {
          throw new Error("Invalid batch embedding response item");
        }

        const index = item.index!;
        if (ordered[index] !== undefined) {
          throw new Error("Batch response contains a duplicate embedding index");
        }

        const embedding = item.embedding.map(Number);
        if (embedding.length !== 2560 ||
            embedding.some(value => !Number.isFinite(value))) {
          throw new Error("Batch embedding has invalid dimensions or values");
        }

        ordered[index] = embedding;
      }

      if (ordered.some(embedding => !embedding)) {
        throw new Error("Batch response is missing one or more indexed embeddings");
      }

      missingTexts.forEach((key, batchIndex) => {
        const embedding = ordered[batchIndex];
        if (!embedding) throw new Error(`Missing embedding at index ${batchIndex}`);
        cacheEmbedding(key, embedding);

        for (const originalIndex of missingByKey.get(key) ?? []) {
          results[originalIndex] = embedding;
        }
      });

      return results.map(embedding => embedding ?? []);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    const message = err?.name === "AbortError"
      ? `request timed out after ${REQUEST_TIMEOUT_MS}ms`
      : err?.message || String(err);

    console.warn(`[Batch Embeddings] ${message}; falling back to individual requests.`);

    // Keep the existing single-input retry/timeout behavior as fallback.
    for (const key of missingTexts) {
      const embedding = await getEmbedding(key);
      for (const originalIndex of missingByKey.get(key) ?? []) {
        results[originalIndex] = embedding;
      }
    }

    return results.map(embedding => embedding ?? []);
  }
}

// Alias for legacy imports
export { getEmbedding as embedText };
