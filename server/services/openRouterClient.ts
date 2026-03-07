// server/services/openRouterClient.ts

import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= RESPONSE TYPE ================= */

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string;
    };
    text?: string;
  }[];
}

/* ================= SETTINGS ================= */

const MODEL = "qwen/qwen3.5-flash-02-23";

const MAX_PROMPT_LENGTH = 3200;
const REQUEST_TIMEOUT = 15000;
const MAX_RETRIES = 2;

/* ================= PROMPT CLEANER ================= */

function cleanPrompt(prompt: string): string {

  if (!prompt) return "";

  let cleaned = prompt
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > MAX_PROMPT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_PROMPT_LENGTH);
  }

  return cleaned;

}

/* ================= RESPONSE VALIDATION ================= */

function isValidResponse(text: string): boolean {

  if (!text) return false;

  if (text.length < 20) return false;

  const badPatterns = [
    "```",
    "<|",
    "|>",
    "assistant:",
    "system:"
  ];

  for (const p of badPatterns) {
    if (text.toLowerCase().includes(p)) {
      return false;
    }
  }

  return true;

}

/* ================= MAIN GENERATION ================= */

export async function generateOpenRouter(
  prompt: string
): Promise<string> {

  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY missing");
    return "";
  }

  prompt = cleanPrompt(prompt);

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= MAX_RETRIES) {

    attempt++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {

      console.log(`⚡ OpenRouter attempt ${attempt} using ${MODEL}`);

      const res = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://digitaltransitionmarketing.com",
            "X-Title": "Neon Vision AI",
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.25,
            max_tokens: 500,
            top_p: 0.9,

            messages: [
              {
                role: "system",
                content:
                  "You are Neon Vision, the AI strategist for Digital Transition Marketing. Always respond as Neon Vision. Never mention DT Genie. Use provided company knowledge when available."
              },
              {
                role: "user",
                content: prompt
              }
            ]
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {

        const text = await res.text();

        throw new Error(`OpenRouter HTTP ${res.status}: ${text}`);

      }

      const data = (await res.json()) as OpenRouterResponse;

      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";

      const text = content.trim();

      if (!isValidResponse(text)) {
        throw new Error("Invalid response pattern from model");
      }

      console.log("✅ OpenRouter success");

      return text;

    } catch (err: any) {

      clearTimeout(timeout);

      lastError = err;

      console.warn(`⚠️ OpenRouter attempt ${attempt} failed:`, err.message);

      if (attempt <= MAX_RETRIES) {

        const delay = 2000 * attempt;

        console.log(`⏳ retrying in ${delay / 1000}s`);

        await new Promise((r) => setTimeout(r, delay));

      }

    }

  }

  console.error("❌ All OpenRouter attempts failed:", lastError);

  return "";

}
