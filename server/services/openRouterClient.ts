// server/services/openRouterClient.ts
import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

/**
 * Generate response using OpenRouter Qwen model with retries and backoff
 */
export async function generateOpenRouter(
  prompt: string,
  maxRetries = 2
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is NOT defined");
    return "";
  }

  // === Truncate prompt to avoid token overflow ===
  const MAX_PROMPT_LENGTH = 4000;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    prompt = prompt.slice(0, MAX_PROMPT_LENGTH) + "\n[TRUNCATED]";
  }

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    attempt++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      console.log(`🔹 OpenRouter attempt ${attempt}...`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://dt-genie-backend.onrender.com",
          "X-Title": "DT Genie Backend",
        },
        body: JSON.stringify({
          model: "qwen/Qwen3.5-35B-A3B",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as OpenRouterResponse;
      const content = data?.choices?.[0]?.message?.content;

      if (!content) throw new Error("OpenRouter returned empty content");

      console.log("✅ OpenRouter success");
      return content.trim();
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`⚠️ OpenRouter attempt ${attempt} failed:`, err.message);

      // Exponential backoff before retry
      if (attempt <= maxRetries) {
        const delay = 2000 * attempt; // 2s, 4s, etc.
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  console.error("❌ All OpenRouter attempts failed:", lastError);
  return ""; // Let Gemini fallback handle
}
