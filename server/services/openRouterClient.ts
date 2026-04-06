// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { shouldTriggerBooking } from "./bookingTrigger.js";
import type { LeadScore } from "./leadQualifier.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= RESPONSE TYPE ================= */
interface OpenRouterResponse {
  choices?: {
    message?: { content?: string };
    text?: string;
  }[];
}

/* ================= MODEL ================= */
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

/* ================= VALIDATION ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 25) return false;
  const lower = text.toLowerCase();
  return !(
    lower.includes("<|") ||
    lower.includes("|>") ||
    lower.includes("undefined") ||
    lower.includes("traceback")
  );
}

function isBadFallback(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("try again") ||
    t.includes("temporary issue") ||
    t.includes("slight delay")
  );
}

function ensureComplete(text: string): string {
  if (!/[.!?]$/.test(text)) return text + ".";
  return text;
}

function fixSpacing(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= INTENT ================= */
function detectHighIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /(book|schedule|call|hire|start now|let's start|ready to proceed)/i.test(
    lower
  );
}

/* ================= CACHE ================= */
const recentCache: Map<string, string> = new Map();

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return "Tell me your goal — I’ll map out the exact strategy for you.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt.toLowerCase()}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ---------- CONTEXT + BRAIN ---------- */
  let contextText = "";
  let executionMode = "exploration";
  let highIntent = detectHighIntent(prompt);

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt.slice(0, 300), sessionId);

      const leadScore: LeadScore | number | undefined = brainContext.leadScore;
      const totalScore = typeof leadScore === "number"
        ? leadScore
        : (leadScore as LeadScore)?.total ?? 0;

      // Pre-process strong intent: force execution mode
      if (highIntent) {
        (brainContext as any).executionMode = "execution";
        executionMode = "execution";
        await shouldTriggerBooking(sessionId, brainContext.stage);
      } else {
        executionMode = (brainContext as any).executionMode || "exploration";
      }

      const industry = (brainContext as any)?.industry || "unknown";
      const businessType = (brainContext as any)?.businessType || "";
      const goals = Array.isArray((brainContext as any)?.goals)
        ? (brainContext as any).goals.join(", ")
        : "unknown";

      const recentMessages = (brainContext as any)?.recentMessages || [];
      const dynamicGreeting = (brainContext as any)?.dynamicGreeting || "";

      contextText = `
User Stage: ${brainContext.stage || "unknown"}
Execution Mode: ${executionMode}
Lead Score: ${totalScore.toFixed(2)}
Business Context: ${industry} ${businessType}
Goal: ${goals}
Recent Messages: ${recentMessages.join("\n")}
Dynamic Greeting: ${dynamicGreeting}
`;
    } catch (err) {
      console.warn("⚠️ brainContext failed:", err);
    }
  }

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
        temperature: highIntent ? 0.5 : 0.4,
        top_p: 0.9,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: `You are Neon Vision, an elite AI marketing strategist.

You think like a senior consultant.

Rules:
- Give actionable strategies (not generic advice)
- Break into steps if needed
- Tie answers to business outcomes
- Be confident and clear
- No filler, no fluff

Tone: ${highIntent ? "decisive, conversion-focused" : "strategic, helpful"}`,
          },
          {
            role: "user",
            content: `${contextText}\nUser Request: ${prompt}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(await res.text());

    const data = (await res.json()) as OpenRouterResponse;

    let raw = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    let text = cleanResponse(raw);

    /* ---------- VALIDATION ---------- */
    if (!isValidResponse(text) || isBadFallback(text)) {
      throw new Error("Bad response");
    }

    text = fixSpacing(text);
    text = ensureComplete(text);

    /* ---------- CACHE ONLY GOOD RESPONSES ---------- */
    if (text.length > 40) {
      recentCache.set(cacheKey, text);
    }

    console.log("✅ OpenRouter success");
    return text;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn("⚠️ OpenRouter failed:", err?.message);

    /* ---------- SMART FALLBACK ---------- */
    return `Here’s the right way to approach this:

1. Define your exact goal (traffic, leads, or sales)
2. Identify your current bottleneck
3. Apply a targeted strategy based on that

Tell me your current setup and I’ll map this out precisely for you.`;
  }
}
