// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { shouldTriggerBooking, type Stage } from "./bookingTrigger.js";
import type { LeadScore } from "./leadQualifier.js";
import crypto from "crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= SAFE BRAIN TYPE ================= */
type SafeBrainContext = {
  stage?: string;
  executionMode?: string;
  leadScore?: LeadScore | number;
  detectedServices?: string[];
  goals?: string[];
  recentMessages?: string[];
  dynamicGreeting?: string;
  industry?: string;
  businessType?: string;
  isFresh?: boolean;
};

/* ================= RESPONSE TYPE ================= */
interface OpenRouterResponse {
  choices?: {
    message?: { content?: string };
    text?: string;
  }[];
}

/* ================= CONFIG ================= */
const MODEL = "qwen/qwen3-235b-a22b-2507";
const REQUEST_TIMEOUT = 12000;
const MAX_PROMPT_LENGTH = 4200;
const MAX_RETRIES = 1;

/* ================= CLEAN PROMPT ================= */
function cleanPrompt(prompt: string): string {
  return (
    prompt
      ?.replace(/\s+/g, " ")
      .replace(/assistant:|system:/gi, "")
      .trim()
      .slice(0, MAX_PROMPT_LENGTH) || ""
  );
}

/* ================= RESPONSE VALIDATION ================= */
function isValidResponse(text: string): boolean {
  if (!text || text.length < 20) return false;
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

function finalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\.\!\?]$/, (m) => m + ".");
}

/* ================= INTENT DETECTION ================= */
function detectHighIntent(message: string): boolean {
  return /(book|schedule|call|hire|start now|let's start|ready)/i.test(message);
}

/* ================= CACHE ================= */
const cache = new Map<string, string>();
function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ================= HELPER: SAFE STAGE ================= */
function toSafeStage(stage?: string): Stage {
  const allowed: Stage[] = ["greeting", "discovery", "strategy", "service", "conversion"];
  return allowed.includes(stage as Stage) ? (stage as Stage) : "greeting";
}

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return "Tell me your goal — I’ll map out the exact strategy for you.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  /* ---------- CONTEXT ---------- */
  let contextText = "";
  let executionMode = "exploration";
  const highIntent = detectHighIntent(prompt);

  let detectedServices: string[] = [];
  let goalsText = "unknown";
  let dynamicGreeting: string | undefined;
  let recentMessages: string[] = [];

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      const ctx = (brainContext || {}) as SafeBrainContext;

      const isFresh = ctx.isFresh ?? false;
      const leadScore = ctx.leadScore;
      const totalScore = typeof leadScore === "number" ? leadScore : leadScore?.total ?? 0;

      detectedServices = isFresh ? [] : ctx.detectedServices || [];
      goalsText = isFresh
        ? "unknown"
        : Array.isArray(ctx.goals)
        ? ctx.goals.join(", ")
        : "unknown";

      recentMessages = isFresh ? [] : ctx.recentMessages || [];
      const industry = ctx.industry || "unknown";
      const businessType = ctx.businessType || "";

      dynamicGreeting = ctx.dynamicGreeting;

      /* ---------- EXECUTION MODE ---------- */
      if (highIntent) {
        executionMode = "execution";
        try {
          const safeStage = toSafeStage(ctx.stage);
          await shouldTriggerBooking(sessionId, safeStage);
        } catch (err) {
          console.warn("[BookingTrigger] Failed:", err);
        }
      } else {
        executionMode = ctx.executionMode || "exploration";
      }

      contextText = `Stage: ${ctx.stage || "unknown"}
Mode: ${executionMode}
Lead Score: ${totalScore.toFixed(2)}
Industry: ${industry} ${businessType}
Services: ${detectedServices.join(", ") || "none"}
Goals: ${goalsText}
Recent: ${recentMessages.slice(-3).join(" | ")}`.trim();
    } catch (err) {
      console.warn("[StrategicBrain] Context load failed:", err);
    }
  }

  /* ---------- GREETING OVERRIDE ---------- */
  const greetingTriggers = ["hi", "hello", "hey", "good morning", "good evening"];
  if (greetingTriggers.some((g) => prompt.toLowerCase().includes(g)) && dynamicGreeting) {
    return dynamicGreeting;
  }

  /* ---------- OPENROUTER CALL WITH RETRY ---------- */
  let attempt = 0;
  let lastError: any;
  while (attempt <= MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "X-Title": "Neon Vision AI",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: highIntent ? 0.6 : 0.45,
          top_p: 0.9,
          max_tokens: 900,
          messages: [
            {
              role: "system",
              content: `
You are Neon Vision — a senior AI marketing strategist.

RULES:
- Always give actionable, step-by-step strategies
- Use detected services: ${detectedServices.join(", ") || "none"}
- Use goals: ${goalsText}
- Use business context
- No generic advice
- No repetition
- No asking same question again

MODE:
${executionMode === "execution"
  ? "Give decisive, conversion-focused actions."
  : "Give strategic insights with next steps."}

CRITICAL:
If context exists, you MUST use it.
              `.trim(),
            },
            {
              role: "user",
              content: `${contextText}\nUser: ${prompt}`,
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

      if (!isValidResponse(text)) throw new Error("Invalid response");

      text = finalize(text);

      if (text.length > 30 && !isBadFallback(text)) {
        cache.set(cacheKey, text);
      }

      return text;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`⚠️ OpenRouter attempt ${attempt} failed:`, err?.message);

      // If last retry, break and use fallback
      if (attempt > MAX_RETRIES) break;
    }
  }

  /* ---------- DYNAMIC FALLBACK ---------- */
  const fallbackOptions = [
    `Let's start by identifying your biggest bottleneck — is it traffic, conversion, or retention?`,
    `Focus on 1–2 core channels first (ads, content, or email) and optimize them based on real data.`,
    `Provide me your niche and I’ll map a precise execution plan for you.`,
  ];

  const fallback = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
  return fallback;
}
