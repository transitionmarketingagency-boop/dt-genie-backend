// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { strategicBrain } from "./strategicBrain.js";
import { memoryService } from "./memoryService.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { shouldTriggerBooking, type Stage } from "./bookingTrigger.js";
import type { LeadScore } from "./leadQualifier.js";
import crypto from "crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= TYPES ================= */
type SafeBrainContext = {
  stage?: string;
  executionMode?: string;
  leadScore?: LeadScore | number;
  detectedServices?: string[];
  goals?: string[];
};

/* ================= CONFIG ================= */
const MODEL = "qwen/qwen3-235b-a22b-2507";
const REQUEST_TIMEOUT = 25000; // ⬅️ increased
const MAX_PROMPT_LENGTH = 4200;
const MAX_RETRIES = 2;

/* ================= CACHE ================= */
const cache = new Map<string, string>();
function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ================= HELPERS ================= */
function cleanPrompt(prompt: string): string {
  return (
    prompt
      ?.replace(/\s+/g, " ")
      .replace(/assistant:|system:/gi, "")
      .trim()
      .slice(0, MAX_PROMPT_LENGTH) || ""
  );
}

function isValidResponse(text: string): boolean {
  if (!text || text.length < 15) return false; // ⬅️ relaxed
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

function detectHighIntent(message: string): boolean {
  return /(book|schedule|call|hire|start|ready|work with you)/i.test(message);
}

function toSafeStage(stage?: string): Stage {
  const allowed: Stage[] = ["greeting", "discovery", "strategy", "service", "conversion"];
  return allowed.includes(stage as Stage) ? (stage as Stage) : "discovery";
}

/* ================= CORE API CALL ================= */
async function callOpenRouter(messages: any[], temperature: number, signal: AbortSignal) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: 900,
      messages,
    }),
    signal,
  });

  const data: any = await res.json();

  return cleanResponse(
    data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ""
  );
}

/* ================= MAIN FUNCTION ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("Missing OpenRouter API Key"); // ⬅️ NO fallback
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  let contextText = "";
  let executionMode = "exploration";
  const highIntent = detectHighIntent(prompt);

  /* ================= CONTEXT ================= */
  try {
    if (sessionId) {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      const ctx = (brainContext || {}) as SafeBrainContext;

      const totalScore =
        typeof ctx.leadScore === "number"
          ? ctx.leadScore
          : ctx.leadScore?.total ?? 0;

      executionMode = highIntent ? "execution" : ctx.executionMode || "exploration";

      if (highIntent) {
        await shouldTriggerBooking(sessionId, toSafeStage(ctx.stage));
      }

      contextText = `
Stage: ${ctx.stage || "unknown"}
Mode: ${executionMode}
Lead Score: ${totalScore.toFixed(2)}
Services: ${ctx.detectedServices?.join(", ") || "none"}
Goals: ${ctx.goals?.join(", ") || "none"}
      `.trim();
    }
  } catch (err) {
    console.warn("[Strategic brain failed]", err);
  }

  /* ================= HARD FALLBACK: MEMORY ================= */
  if (!contextText && sessionId) {
    try {
      const history = await memoryService.getRecentContext(sessionId);
      contextText = history
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .slice(0, 1000);
    } catch {}
  }

  /* ================= FINAL SAFETY ================= */
  if (!contextText) {
    contextText = "No prior context available.";
  }

  const messages = [
    {
      role: "system",
      content: `
You are a senior AI marketing strategist.

Rules:
- Be direct, natural, human
- No robotic tone
- No repeating patterns
- Diagnose real problem
- If user greeting → respond naturally, short, human.
- If user asks identity → explain agency clearly.
- If user asks services → explain offerings clearly.
- Give actionable steps
      `.trim(),
    },
    {
      role: "user",
      content: `${contextText}\nUser: ${prompt}`,
    },
  ];

  /* ================= RETRY LOOP ================= */
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      let text = await callOpenRouter(
        messages,
        highIntent ? 0.6 : 0.5,
        controller.signal
      );

      clearTimeout(timeout);

      if (isValidResponse(text)) {
        text = finalize(text);
        cache.set(cacheKey, text);
        return text;
      }

      // 🔁 retry with slightly different temperature
      attempt++;
    } catch (err) {
      attempt++;
      console.warn(`⚠️ Retry ${attempt} failed`, err);
    }
  }

  // ❌ NO STATIC FALLBACK
  throw new Error("AI response generation failed after retries");
}
