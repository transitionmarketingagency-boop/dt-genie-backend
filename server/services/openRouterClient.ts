import { cleanResponse } from "../utils/cleanResponse.js";
import crypto from "crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= CONFIG ================= */
const MODEL = "qwen/qwen3-235b-a22b";

// ⚡ REDUCED (major latency win)
const REQUEST_TIMEOUT = 7000;

// ⚡ Keep tight
const MAX_PROMPT_LENGTH = 3200;

// ⚡ Keep retries but safer
const MAX_RETRIES = 2;

/* ================= CACHE ================= */
const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

// simple LRU cleanup
function maintainCache() {
  if (cache.size > MAX_CACHE_SIZE) {
    const first = cache.keys().next();

    if (!first.done && first.value) {
      cache.delete(first.value);
    }
  }
}

function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ================= PROMPT CLEAN ================= */
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
function isValidResponse(text: string | null | undefined): text is string {
  if (!text) return false;

  const t = text.trim();

  if (t.length < 100) return false;
  if (t.split(/\s+/).length < 15) return false;

  // ❌ detect incomplete endings
  if (
    /(of|in|and|to|for|with|on|at)$/i.test(t)
  ) return false;

  if (!/[.?!]$/.test(t)) return false;

  if (t.includes("undefined")) return false;
  if (t.includes("Something broke")) return false;

  return true;
}

/* ================= FINAL NORMALIZER ================= */
function finalize(text: string): string {
  return (text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= CORE CALL ================= */
async function callOpenRouter(
  prompt: string,
  temperature: number
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[OpenRouter] Missing API Key");
    return null;
  }

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
        max_tokens: 900, // ⚡ reduced for speed + less truncation risk
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[OpenRouter HTTP Error]", res.status);
      return null;
    }

    const data: any = await res.json();

    const raw =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      null;

    if (!raw) return null;

    return cleanResponse(raw);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[OpenRouter] Timeout");
    } else {
      console.error("[OpenRouter] Error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================= MAIN ================= */
export async function generateOpenRouter(
  prompt: string,
  sessionId?: string
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.warn("[OpenRouter] Disabled - missing key");
    return null;
  }

  prompt = cleanPrompt(prompt);
  if (!prompt) return null;

  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let attempt = 0;
  let response: string | null = null;

  while (attempt < MAX_RETRIES && !response) {

    // 🔹 FIRST TRY
    const base = await callOpenRouter(prompt, 0.55);

    if (isValidResponse(base)) {
      response = finalize(base);
      break;
    }

    // 🔹 SMART RETRY (forces completion)
    const retryPrompt =
      prompt +
      "\n\nIMPORTANT: Finish the answer completely. Do not cut mid-sentence.";

    const retry = await callOpenRouter(retryPrompt, 0.6);

    if (isValidResponse(retry)) {
      response = finalize(retry);
      break;
    }

    attempt++;
  }

  if (response) {
    cache.set(cacheKey, response);
    maintainCache();
    return response;
  }

  return null;
}
