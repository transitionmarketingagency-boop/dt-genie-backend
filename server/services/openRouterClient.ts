// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import type { LeadScore } from "./leadQualifier.js";

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
const REQUEST_TIMEOUT = 12000;
const MAX_PROMPT_LENGTH = 4200;

/* ================= PROMPT CLEANER ================= */
function cleanPrompt(prompt: string): string {
  return (
    prompt
      ?.replace(/\s+/g, " ")
      .replace(/assistant:|system:/gi, "")
      .trim()
      .slice(0, MAX_PROMPT_LENGTH) || ""
  );
}

/* ================= VALIDATION HELPERS ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 15) return false;
  const lower = text.toLowerCase();
  return !(
    lower.includes("<|") ||
    lower.includes("|>") ||
    lower.includes("undefined") ||
    lower.includes("null") ||
    lower.includes("traceback")
  );
}

function isFakeDelay(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("temporary delay") ||
    t.includes("slight delay") ||
    t.includes("having trouble") ||
    t.includes("try again shortly") ||
    t.includes("i can still guide you")
  );
}

function containsNonEnglish(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

function ensureComplete(text: string): string {
  if (!/[.!?]$/.test(text)) return text + ".";
  return text;
}

function fixSpacing(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= SYSTEM PROMPT ================= */
function buildMessages(prompt: string, highIntent: boolean = false) {
  return [
    {
      role: "system",
      content: `You are Neon Vision, AI strategist for Digital Transition Marketing.

Your job:
Give clear, specific, and practical marketing advice.

Rules:
- Answer exactly what the user asked
- Be concise but complete
- Avoid generic responses
- Do NOT mention delays, errors, or system limitations
- Do NOT output broken or incomplete sentences
- Use natural human tone
- Focus on solving real business problems

Tone: ${
        highIntent
          ? "direct, confident, decision-focused"
          : "clear, helpful, professional"
      }`,
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

/* ================= INTENT ================= */
function detectHighIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /(hire|book|schedule|call|work with|i want|let's start|ready)/i.test(lower);
}

/* ================= CACHE ================= */
const recentCache: Map<string, string> = new Map();

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return "I can still guide you — tell me what you're trying to achieve.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt.toLowerCase()}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ---------- CONTEXT (ASYNC) ---------- */
  let contextText = "";

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt.slice(0, 300), sessionId);
      const leadScore: LeadScore | number | undefined = brainContext.leadScore;

      const totalScore =
        typeof leadScore === "number"
          ? leadScore
          : (leadScore as LeadScore)?.total ?? 0;

      contextText = `Context: stage=${brainContext.stage || "unknown"}, score=${totalScore.toFixed(
        2
      )}.`;
    } catch (err) {
      console.warn("⚠️ Failed to fetch brainContext:", err);
      contextText = "";
    }
  }

  const highIntent = detectHighIntent(prompt);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    console.log("⚡ OpenRouter call");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "X-Title": "Neon Vision AI",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: highIntent ? 0.45 : 0.35,
        top_p: 0.9,
        max_tokens: 800,
        messages: buildMessages(`${contextText} ${prompt}`, highIntent),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(await res.text());

    const data = (await res.json()) as OpenRouterResponse;

    let raw = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    let text = cleanResponse(raw);

    /* ---------- VALIDATION ---------- */
    if (!isValidResponse(text) || isFakeDelay(text) || containsNonEnglish(text)) {
      throw new Error("Rejected bad model output");
    }

    text = fixSpacing(text);
    text = ensureComplete(text);

    /* ---------- CACHE CLEAN RESPONSES ---------- */
    recentCache.set(cacheKey, text);

    console.log("✅ OpenRouter success");
    return text;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn("⚠️ OpenRouter failed:", err?.message);
    return "Let me think through this properly — what’s your current setup?";
  }
}
