// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { cleanResponse } from "../utils/cleanResponse.js"; // ✅ SINGLE SOURCE CLEANER

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= RESPONSE TYPE ================= */
interface OpenRouterResponse {
  choices?: {
    message?: { content?: string };
    text?: string;
  }[];
}

/* ================= MODEL & SETTINGS ================= */
const MODEL = "qwen/qwen3-235b-a22b-2507";
const MAX_PROMPT_LENGTH = 5000;
const REQUEST_TIMEOUT = 28000;
const MAX_RETRIES = 2;

/* ================= PROMPT CLEANER ================= */
function cleanPrompt(prompt: string): string {
  if (!prompt) return "";
  return prompt
    .replace(/\s+/g, " ")
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "")
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
}

/* ================= RESPONSE VALIDATION ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 15) return false;

  const lower = text.toLowerCase();
  const badPatterns = ["<|", "|>", "undefined", "null", "traceback"];

  return !badPatterns.some((p) => lower.includes(p));
}

/* ================= SYSTEM PROMPT ================= */
function buildMessages(prompt: string, highIntent: boolean = false) {
  return [
    {
      role: "system",
      content: `You are Neon Vision, AI strategist for Digital Transition Marketing.

Your role is to help businesses grow using Digital Transition Marketing services.

Guidelines:
- Recommend only relevant services
- Respond clearly, naturally, and professionally
- Avoid markdown, symbols, or formatting artifacts
- Be direct and useful
- Answer exactly what the user asks
- No generic templates
- No contact info
- Tone: ${
        highIntent
          ? "confident and strategic"
          : "clear and helpful"
      }`
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
    "sign up",
    "ready to invest",
    "asap"
  ];

  return signals.some((s) => lower.includes(s));
}

/* ================= RESPONSE CACHING ================= */
const recentCache: Map<string, string> = new Map();

/* ================= FALLBACKS ================= */
const fallbackVariants = [
  "I’m having a temporary issue generating a response, but I can still guide you. Tell me more about your goal.",
  "There’s a temporary issue right now, but I can still help. What are you trying to achieve?",
  "I can still guide you manually—tell me what you're trying to improve."
];

/* ================= MAIN GENERATION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY missing");
    return "I’m unable to access AI systems right now, but I can still guide you.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ---------- STRATEGIC CONTEXT ---------- */
  let contextText = "";

  if (sessionId) {
    try {
      const { brainContext, chunks } = await strategicBrain(
        prompt.slice(0, 500),
        sessionId
      );

      const pricingChunk = chunks.find(
        (c: any) =>
          c?.intent?.toLowerCase?.().includes("pricing") && c?.text
      );

      const pricingInfo = pricingChunk
        ? pricingChunk.text
        : "Pricing info not available.";

      contextText = `Context: stage=${brainContext.stage}, leadScore=${brainContext.leadScore}. ${pricingInfo}`;
    } catch (err) {
      console.warn("⚠️ strategicBrain failed:", err);
    }
  }

  const highIntent = detectHighIntent(prompt);
  let lastError: any = null;

  /* ---------- RETRY LOOP ---------- */
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      console.log(`⚡ OpenRouter attempt ${attempt}`);

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
            temperature: highIntent ? 0.45 : 0.38,
            top_p: 0.9,
            max_tokens: 1200,
            messages: buildMessages(`${contextText} ${prompt}`, highIntent)
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as OpenRouterResponse;

      let raw =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";

      // ✅ ONLY CLEAN ONCE (CRITICAL FIX)
      let text = cleanResponse(raw);

      if (!isValidResponse(text)) {
        throw new Error("Invalid response");
      }

      recentCache.set(cacheKey, text);

      console.log("✅ OpenRouter success");
      return text;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      console.warn(`⚠️ Attempt ${attempt} failed:`, err?.message);

      if (attempt <= MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
  }

  console.error("❌ OpenRouter failed:", lastError);

  /* ---------- FALLBACK ---------- */
  const fallback =
    fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)];

  recentCache.set(cacheKey, fallback);
  return fallback;
}
