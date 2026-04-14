// server/services/openRouterClient.ts

import { cleanResponse } from "../utils/cleanResponse.js";
import crypto from "crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= CONFIG ================= */
const MODEL = "qwen/qwen3-235b-a22b";
const REQUEST_TIMEOUT = 12000;
const MAX_PROMPT_LENGTH = 3500;
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

/* ================= RESPONSE VALIDATION ================= */
function isComplete(text: string | null | undefined): text is string {
  if (!text) return false;

  const t = text.trim();

  if (t.length < 80) return false;
  if (!/[.?!]$/.test(t)) return false;
  if (t.includes("undefined")) return false;
  if (t.includes("Something broke")) return false;
  if (t.split(" ").length < 12) return false;

  return true;
}

function finalize(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= CORE CALL ================= */
async function callOpenRouter(
  prompt: string,
  temperature: number
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature,
        max_tokens: 1400,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    /* 🔥 HANDLE HTTP ERRORS */
    if (!res.ok) {
      const errText = await res.text();
      console.error("[OpenRouter HTTP Error]", res.status, errText);
      return null;
    }

    const data: any = await res.json();

    const raw =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      null;

    if (!raw) {
      console.warn("[OpenRouter] Empty response structure", data);
      return null;
    }

    return cleanResponse(raw);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn("[OpenRouter] Request timed out");
    } else {
      console.error("[OpenRouter] Fetch failed:", err);
    }
    return null;
  }
}

/* ================= MAIN ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("Missing OpenRouter API Key");
  }

  prompt = cleanPrompt(prompt);

  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let attempt = 0;
  let response: string | null = null;

  while (attempt < MAX_RETRIES && !response) {
    try {
      /* ================= PRIMARY ================= */
      const raw = await callOpenRouter(prompt, 0.5);

      if (isComplete(raw)) {
        response = finalize(raw);
        break;
      }

      /* ================= RETRY ================= */
      const retryPrompt =
        prompt +
        "\n\nRespond clearly with complete sentences. Do not cut off.";

      const retry = await callOpenRouter(retryPrompt, 0.6);

      if (isComplete(retry)) {
        response = finalize(retry);
        break;
      }
    } catch (err) {
      console.warn(`[OpenRouter attempt ${attempt + 1} failed]`, err);
    }

    attempt++;
  }

  /* ================= CACHE ONLY VALID ================= */
  if (response) {
    cache.set(cacheKey, response);
    return response;
  }

  /* ❌ LET CALLER HANDLE FAILURE (CRITICAL DESIGN) */
  return null;
}
