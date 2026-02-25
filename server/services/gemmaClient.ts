// server/services/gemmaClient.ts
import fetch from "node-fetch";

/**
 * Gemma Client (Ollama HTTP-based)
 * Node.js-safe
 * Uses 127.0.0.1
 */

const GEMMA_URL = process.env.GEMMA_URL || "http://127.0.0.1:11434/api/generate";
const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma3:1b";
const GEMMA_TIMEOUT = 30000; // 30s

interface GemmaResponse {
  response?: string;
}

export async function generateGemma(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMMA_TIMEOUT);

  try {
    const res = await fetch(GEMMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        prompt,
        stream: false, // Disable streaming for Node.js compatibility
        options: {
          temperature: 0.4,
          num_predict: 512,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`⚠️ Gemma HTTP Error: ${res.status}`);
      return "";
    }

    // Type-safe parsing
    const data = (await res.json()) as Partial<GemmaResponse>;

    if (!data?.response) {
      console.warn("⚠️ Gemma returned empty response");
      return "";
    }

    return data.response.trim();
  } catch (err: unknown) {
    clearTimeout(timeout);

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        console.warn("⚠️ Gemma timeout (30s)");
      } else {
        console.warn("⚠️ Gemma failed:", err.message);
      }
    } else {
      console.warn("⚠️ Gemma failed:", String(err));
    }

    return "";
  }
}

// Exporting for use in hybrid response
export const gemmaClient = generateGemma;
