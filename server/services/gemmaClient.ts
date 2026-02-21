import fetch from "node-fetch";

/**
 * Gemma Client (Ollama HTTP-based)
 * Stable + Windows-safe
 * Uses 127.0.0.1 instead of localhost
 */

const GEMMA_URL =
  process.env.GEMMA_URL || "http://127.0.0.1:11434/api/generate";

const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma3:1b";

const GEMMA_TIMEOUT = 30000; // 30 seconds

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
        stream: false,
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

    const data: any = await res.json();

    if (!data || !data.response) {
      console.warn("⚠️ Gemma returned empty response");
      return "";
    }

    return data.response.trim();
  } catch (err: any) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      console.warn("⚠️ Gemma timeout (30s)");
    } else {
      console.warn("⚠️ Gemma failed:", err.message || err);
    }

    return "";
  }
}

export const gemmaClient = generateGemma;
