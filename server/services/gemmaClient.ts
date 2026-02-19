import fetch from "node-fetch";

/**
 * Gemma Client (Ollama HTTP-based)
 * - Clean timeout handling
 * - No child_process
 * - Safe fallback behavior
 */

const GEMMA_URL =
  process.env.GEMMA_URL || "http://localhost:11434/api/generate";

const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma";
const GEMMA_TIMEOUT = 8000; // 8 seconds max

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
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Gemma HTTP ${res.status}`);
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
      console.warn("⚠️ Gemma timeout");
    } else {
      console.warn("⚠️ Gemma failed:", err.message || err);
    }

    return "";
  }
}

/* ---------------- Backward compatibility ---------------- */
export const gemmaClient = generateGemma;
