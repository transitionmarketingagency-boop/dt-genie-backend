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
  return cleaned.slice(0, MAX_PROMPT_LENGTH);
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
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, MAX_RESPONSE_CHARS);
}

/* ================= RESPONSE VALIDATION ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 25) return false;
  const lower = text.toLowerCase();
  const badPatterns = ["<|", "|>", "undefined", "null", "error", "traceback"];
  return !badPatterns.some((p) => lower.includes(p));
}

/* ================= SYSTEM PROMPT ================= */
function buildMessages(prompt: string, highIntent: boolean = false) {
  return [
    {
      role: "system",
      content: `You are Neon Vision, AI strategist for Digital Transition Marketing.
      
Your role is to help businesses grow using the 14 core services of Digital Transition Marketing.

Guidelines:
- Recommend only Digital Transition Marketing services.
- Explain external tools briefly if mentioned, then guide to DTM solutions.
- Respond concisely, clearly, and professionally.
- Avoid markdown, bullets, headings, hashtags, emojis, or code blocks.
- Keep responses actionable, aligned with user intent.
- Tone: ${
        highIntent
          ? "executive, confident, persuasive"
          : "friendly, informative, clear"
      }.`
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

/* ================= HIGH-INTENT DETECTION ================= */
function detectHighIntent(message: string): boolean {
  if (!message) return false;
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
    return "Apologies, I cannot access AI systems right now, but I can still provide guidance.";
  }

  prompt = cleanPrompt(prompt);

  // Add strategicBrain context if available
  let contextText = "";
  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      contextText = `Context: User stage=${brainContext.stage}, leadScore=${brainContext.leadScore}, recommendedService=${brainContext.recommendedService}. `;
    } catch (err) {
      console.warn("⚠️ strategicBrain fetch failed:", err);
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
      const raw = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";

      const text = cleanResponse(raw);

      if (!isValidResponse(text)) throw new Error("Invalid response pattern");

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
  return "I'm currently having trouble generating a response, but I can provide guidance manually.";
}
