// server/services/openRouterClient.ts
import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";

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

/* ================= MODEL & SETTINGS ================= */
const MODEL = "qwen/qwen3-235b-a22b-2507";
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
  if (!text || text.length < 25) return false;
  const lower = text.toLowerCase();
  const badPatterns = ["<|", "|>", "undefined", "null"];
  return !badPatterns.some((p) => lower.includes(p));
}

/* ================= SYSTEM PROMPT ================= */
function buildMessages(prompt: string, highIntent: boolean = false) {
  return [
    {
      role: "system",
      content: `You are Neon Vision, the AI strategist for Digital Transition Marketing.
      
Your role is to help businesses grow using the 14 core services offered by Digital Transition Marketing.

Guidelines:
- Only recommend services offered by Digital Transition Marketing.
- Never recommend competing platforms, AI tools, or external services.
- If users ask about external tools, explain briefly but guide to Digital Transition Marketing solutions.
- Respond professionally, concisely, in clear natural language.
- Avoid markdown, headings, bullets, hashtags, emojis, or code blocks.
- Keep responses actionable, relevant, aligned with user intent.
- Adjust tone dynamically: ${
        highIntent
          ? "executive, confident, and persuasive for high-intent users"
          : "friendly, informative, and clear for general users"
      }.
`
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

/* ================= HIGH-INTENT DETECTION ================= */
function detectHighIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const signals = [
    "hire",
    "book",
    "schedule",
    "consultation",
    "call",
    "work with",
    "i want",
    "let's start",
    "sign up"
  ];
  return signals.some((s) => lower.includes(s));
}

/* ================= MAIN GENERATION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY missing");
    return "Apologies, I cannot access AI systems at the moment, but I can still assist you with guidance.";
  }

  prompt = cleanPrompt(prompt);

  // Use strategicBrain for context-aware response
  let contextText = "";
  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      contextText = `Context: User stage=${brainContext.stage}, leadScore=${brainContext.leadScore}, recommendedService=${brainContext.recommendedService}. `;
    } catch (err) {
      console.warn("⚠️ strategicBrain context fetch failed:", err);
    }
  }

  const highIntent = detectHighIntent(prompt);

  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      console.log(`⚡ OpenRouter attempt ${attempt} using ${MODEL} (highIntent=${highIntent})`);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "X-Title": "Neon Vision AI"
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: highIntent ? 0.45 : 0.38,
          top_p: highIntent ? 0.95 : 0.9,
          max_tokens: 700,
          messages: buildMessages(`${contextText}${prompt}`, highIntent)
        }),
        signal: controller.signal
      });

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

      if (!isValidResponse(text)) throw new Error("Invalid response pattern from model");

      console.log("✅ OpenRouter success");
      return text;

    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`⚠️ OpenRouter attempt ${attempt} failed:`, err?.message ?? err);

      if (attempt <= MAX_RETRIES) {
        const delay = 2000 * attempt;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  console.error("❌ All OpenRouter attempts failed:", lastError);
  return "I'm having trouble generating a response right now, but I can still assist with advice or guidance.";
}
