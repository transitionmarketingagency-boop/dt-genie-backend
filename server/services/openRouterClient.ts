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

function finalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\.\!\?]$/, (m) => m + ".");
}

/* ================= 🔥 NEW SMART FALLBACK ================= */
function smartFallback(detectedServices: string[], goalsText: string): string {
  if (detectedServices.length > 0) {
    return `You're focusing on ${detectedServices.join(
      ", "
    )}. Here's the fastest way to improve results:

1. Fix conversion bottlenecks first (landing page, offer clarity)
2. Align traffic source with intent (ads vs organic mismatch is common)
3. Optimize one channel deeply before scaling

If you want, I can break this into a step-by-step execution plan.`;
  }

  if (goalsText && goalsText !== "unknown") {
    return `To achieve "${goalsText}", you need to focus on:

1. Identifying the highest ROI acquisition channel
2. Fixing conversion leaks before scaling traffic
3. Building a simple but optimized funnel

Tell me your current setup and I’ll refine this into a precise plan.`;
  }

  return `To improve results, focus on this sequence:

1. Identify your biggest bottleneck (traffic vs conversion vs retention)
2. Fix that layer completely before adding complexity
3. Scale only what is already working

If you share your current setup, I’ll give you exact next steps.`;
}

/* ================= INTENT DETECTION ================= */
function detectHighIntent(message: string): boolean {
  return /(book|schedule|call|hire|start now|ready|help with)/i.test(message);
}

/* ================= CACHE ================= */
const cache = new Map<string, string>();
function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ================= HELPER ================= */
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

  let contextText = "";
  let executionMode = "exploration";
  const highIntent = detectHighIntent(prompt);

  let detectedServices: string[] = [];
  let goalsText = "unknown";
  let dynamicGreeting: string | undefined;

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      const ctx = (brainContext || {}) as SafeBrainContext;

      const totalScore =
        typeof ctx.leadScore === "number"
          ? ctx.leadScore
          : ctx.leadScore?.total ?? 0;

      detectedServices = ctx.detectedServices || [];
      goalsText = Array.isArray(ctx.goals) ? ctx.goals.join(", ") : "unknown";

      dynamicGreeting = ctx.dynamicGreeting;

      if (highIntent) {
        executionMode = "execution";
        await shouldTriggerBooking(sessionId, toSafeStage(ctx.stage));
      } else {
        executionMode = ctx.executionMode || "exploration";
      }

      contextText = `Stage: ${ctx.stage || "unknown"}
Mode: ${executionMode}
Lead Score: ${totalScore.toFixed(2)}
Services: ${detectedServices.join(", ") || "none"}
Goals: ${goalsText}`.trim();
    } catch (err) {
      console.warn("[Context failed]:", err);
    }
  }

  /* ---------- GREETING FIX ---------- */
  if (/^(hi|hello|hey)$/i.test(prompt.trim()) && dynamicGreeting) {
    return dynamicGreeting;
  }

  /* ---------- OPENROUTER ---------- */
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: highIntent ? 0.6 : 0.45,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: `You are a senior AI marketing strategist. Give direct, actionable strategies. No fluff.`,
          },
          {
            role: "user",
            content: `${contextText}\nUser: ${prompt}`,
          },
        ],
      }),
    });

    const data = (await res.json()) as OpenRouterResponse;
    let text = cleanResponse(
      data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        ""
    );

    if (!isValidResponse(text)) throw new Error("Invalid AI response");

    text = finalize(text);
    cache.set(cacheKey, text);

    return text;
  } catch (err) {
    console.warn("⚠️ OpenRouter failed:", err);
  }

  /* ---------- ✅ FINAL FALLBACK ---------- */
  return smartFallback(detectedServices, goalsText);
}
