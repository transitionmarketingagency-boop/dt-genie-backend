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
  if (!text || text.length < 25) return false;
  const lower = text.toLowerCase();
  return !(
    lower.includes("<|") ||
    lower.includes("|>") ||
    lower.includes("undefined") ||
    lower.includes("traceback")
  );
}

/* ================= FINAL CLEAN ================= */
function finalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\.\!\?]$/, (m) => m + ".");
}

/* ================= INTENT DETECTION ================= */
function detectHighIntent(message: string): boolean {
  return /(book|schedule|call|hire|start now|ready|help with|assist me)/i.test(message);
}

/* ================= CACHE ================= */
const cache = new Map<string, string>();
function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ================= SAFE STAGE ================= */
function toSafeStage(stage?: string): Stage {
  const allowed: Stage[] = ["greeting", "discovery", "strategy", "service", "conversion"];
  return allowed.includes(stage as Stage) ? (stage as Stage) : "discovery";
}

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    // Dynamic default message if API key is missing
    return `I can't access my AI engine right now, but share your goal and current setup, and I can respond dynamically.`;
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  let contextText = "";
  let executionMode = "exploration";
  const highIntent = detectHighIntent(prompt);

  let detectedServices: string[] = [];
  let goalsText = "";

  /* ---------- CONTEXT ---------- */
  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      const ctx = (brainContext || {}) as SafeBrainContext;

      const totalScore =
        typeof ctx.leadScore === "number"
          ? ctx.leadScore
          : ctx.leadScore?.total ?? 0;

      detectedServices = ctx.detectedServices || [];
      goalsText = Array.isArray(ctx.goals) ? ctx.goals.join(", ") : "";

      executionMode = highIntent ? "execution" : ctx.executionMode || "exploration";

      if (highIntent) {
        await shouldTriggerBooking(sessionId, toSafeStage(ctx.stage));
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

  /* ---------- OPENROUTER CALL ---------- */
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

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
            content: `
You are a senior AI marketing strategist.
Rules:
- Be direct and actionable
- Diagnose the real problem
- Give execution steps
- No generic advice
- No repeating questions
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

    const data = (await res.json()) as OpenRouterResponse;

    let text = cleanResponse(
      data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ""
    );

    if (!isValidResponse(text)) {
      // Dynamic fallback: just echo context + prompt in natural way
      text = `Based on your current context:\n${contextText}\nYour query: "${prompt}". Let's explore the next steps dynamically.`;
    }

    text = finalize(text);

    if (text.length > 30) cache.set(cacheKey, text);
    return text;
  } catch (err) {
    console.warn("⚠️ OpenRouter failed:", err);
    // Dynamic fallback
    return `I encountered a temporary issue generating a response, but based on your context:\n${contextText}\nYou asked: "${prompt}"`;
  }
}
