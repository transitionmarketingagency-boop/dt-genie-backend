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
 * Generates a response using OpenRouter Qwen3.5-35B-A3B model
 * with retry logic to handle live Render environment issues
 */
export async function generateOpenRouter(
  prompt: string,
  maxRetries = 2
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is NOT defined");
    return "";
  }

  console.log("✅ OPENROUTER_API_KEY detected");

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 800,
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

      if (!content) {
        throw new Error("OpenRouter returned empty content");
      }

      console.log("✅ Qwen response received");
      return content.trim();
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === "AbortError") {
        console.warn(`⚠️ OpenRouter request timed out (60s) on attempt ${attempt}`);
      } else {
        console.warn(`⚠️ OpenRouter request failed on attempt ${attempt}:`, err.message || err);
      }

      if (attempt <= maxRetries) {
        const backoff = 2000 * attempt; // 2s, 4s, etc.
        console.log(`🔄 Retrying after ${backoff}ms...`);
        await new Promise((res) => setTimeout(res, backoff));
      }
    }
  }

  console.error("❌ All OpenRouter attempts failed:", lastError);
  return "";
}
