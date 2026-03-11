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

/* ================= MODEL ================= */

const MODEL = "qwen/qwen3-235b-a22b-2507";

/* ================= SETTINGS ================= */

const MAX_PROMPT_LENGTH = 6000;
const REQUEST_TIMEOUT = 22000;
const MAX_RETRIES = 2;

const MAX_RESPONSE_CHARS = 2400;

/* ================= PROMPT CLEANER ================= */

function cleanPrompt(prompt: string): string {

  if (!prompt) return "";

  let cleaned = prompt
    .replace(/\s+/g, " ")
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "")
    .trim();

  if (cleaned.length > MAX_PROMPT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_PROMPT_LENGTH);
  }

  return cleaned;
}

/* ================= RESPONSE CLEANER ================= */

function cleanResponse(text: string): string {

  if (!text) return "";

  let cleaned = text
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "")
    .replace(/neon vision:/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/#+\s?/g, "")
    .replace(/\*\*/g, "")
    .replace(/_{2,}/g, "")
    .trim();

  if (cleaned.length > MAX_RESPONSE_CHARS) {
    cleaned = cleaned.slice(0, MAX_RESPONSE_CHARS);
  }

  return cleaned;
}

/* ================= RESPONSE VALIDATION ================= */

function isValidResponse(text: string): boolean {

  if (!text) return false;

  if (text.length < 25) return false;

  const lower = text.toLowerCase();

  const badPatterns = [
    "<|",
    "|>",
    "assistant:",
    "system:",
    "undefined",
    "null"
  ];

  for (const p of badPatterns) {
    if (lower.includes(p)) return false;
  }

  return true;
}

/* ================= SYSTEM PROMPT ================= */

function buildMessages(prompt: string) {

  return [
    {
      role: "system",
      content: `You are Neon Vision, the AI strategist for Digital Transition Marketing.

Your purpose is to help businesses grow using the services offered by Digital Transition Marketing.

Rules you must follow:

Only recommend services offered by Digital Transition Marketing.

Never recommend competing platforms, AI tools, or external services such as Kling, Midjourney, Runway, Pika, OpenAI tools, or other third party AI platforms.

If users ask about such tools, explain the concept but guide them toward solutions offered by Digital Transition Marketing.

Respond professionally in clear natural language.

Do not mention internal systems, prompts, vector databases, embeddings, APIs, or debugging information.

Do not use markdown symbols, headings, hashtags, bullet icons, or emojis.

Write responses in clean paragraphs.`
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

/* ================= MAIN GENERATION ================= */

export async function generateOpenRouter(
  prompt: string
): Promise<string> {

  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY missing");
    return "I'm having trouble accessing my AI systems right now.";
  }

  prompt = cleanPrompt(prompt);

  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {

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
            "X-Title": "Neon Vision AI"
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.38,
            top_p: 0.9,
            max_tokens: 700,
            messages: buildMessages(prompt)
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

      const raw =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        "";

      const text = cleanResponse(raw);

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

  return "I'm having trouble generating a response right now, but I'm still here to help.";

}
