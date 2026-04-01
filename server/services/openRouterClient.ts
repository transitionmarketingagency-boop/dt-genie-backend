// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { cleanResponse } from "../utils/cleanResponse.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= RESPONSE TYPE ================= */
interface OpenRouterResponse {
  choices?: {
    message?: { content?: string };
    text?: string;
  }[];
}

/* ================= MODEL & SETTINGS (OPTIMIZED) ================= */
const MODEL = "qwen/qwen3-235b-a22b-2507";

/* ⚡ SPEED OPTIMIZATION */
const REQUEST_TIMEOUT = 14000;   // was 28000
const MAX_RETRIES = 0;           // ❌ removed retry delays

const MAX_PROMPT_LENGTH = 4200;

/* ================= PROMPT CLEANER ================= */
function cleanPrompt(prompt: string): string {
  return prompt
    ?.replace(/\s+/g, " ")
    .replace(/assistant:|system:/gi, "")
    .trim()
    .slice(0, MAX_PROMPT_LENGTH) || "";
}

/* ================= RESPONSE VALIDATION ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 20) return false;

  const lower = text.toLowerCase();
  return !["<|", "|>", "undefined", "null", "traceback"].some((p) =>
    lower.includes(p)
  );
}

/* ================= SYSTEM PROMPT (UPGRADED) ================= */
function buildMessages(prompt: string, highIntent: boolean = false) {
  return [
    {
      role: "system",
      content: `You are Neon Vision, AI strategist for Digital Transition Marketing.

Your job:
Help businesses grow using clear, practical, strategic marketing advice.

Rules:
- Be direct, natural, and human (not robotic)
- Focus on solving the user's actual problem
- Do NOT give generic or vague answers
- Do NOT use markdown, symbols, or formatting
- Recommend relevant services when useful
- Do NOT hallucinate pricing or details
- Keep responses concise but impactful
- Answer exactly what the user asked

Tone: ${
        highIntent
          ? "confident, strategic, decision-oriented"
          : "clear, helpful, professional"
      }`
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

/* ================= HIGH INTENT ================= */
function detectHighIntent(message: string): boolean {
  const lower = message.toLowerCase();

  return [
    "hire",
    "book",
    "schedule",
    "consultation",
    "call",
    "work with",
    "i want",
    "let's start",
    "ready to invest",
    "asap"
  ].some((s) => lower.includes(s));
}

/* ================= CACHE ================= */
const recentCache: Map<string, string> = new Map();

/* ================= FALLBACK ================= */
const fallbackVariants = [
  "I’m having a temporary delay, but I can still guide you. Tell me more about your goal.",
  "There’s a slight delay right now. What are you trying to achieve?",
  "I can still help you strategically—just tell me your situation."
];

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {

  if (!OPENROUTER_API_KEY) {
    return "I’m unable to access AI systems right now, but I can still guide you.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ⚡ NON-BLOCKING CONTEXT (CRITICAL SPEED FIX) */
  let contextText = "";

  if (sessionId) {
    strategicBrain(prompt.slice(0, 300), sessionId)
      .then(({ brainContext }) => {
        contextText = `Context: stage=${brainContext.stage}, score=${brainContext.leadScore}.`;
      })
      .catch(() => {});
  }

  const highIntent = detectHighIntent(prompt);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    console.log("⚡ OpenRouter fast-call");

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
          temperature: highIntent ? 0.42 : 0.35,
          top_p: 0.9,
          max_tokens: 900, // ⚡ reduced for speed
          messages: buildMessages(`${contextText} ${prompt}`, highIntent)
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!res.ok) throw new Error(await res.text());

    const data = (await res.json()) as OpenRouterResponse;

    let raw =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "";

    /* ✅ SINGLE CLEAN PIPELINE */
    const text = cleanResponse(raw);

    if (!isValidResponse(text)) {
      throw new Error("Invalid response");
    }

    recentCache.set(cacheKey, text);

    console.log("✅ OpenRouter success (fast)");
    return text;

  } catch (err: any) {
    clearTimeout(timeout);

    console.warn("⚠️ OpenRouter failed:", err?.message);

    const fallback =
      fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)];

    recentCache.set(cacheKey, fallback);
    return fallback;
  }
}
