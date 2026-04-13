// server/services/openRouterClient.ts

import fetch from "node-fetch";
import { cleanResponse } from "../utils/cleanResponse.js";
import crypto from "crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/* ================= CONFIG ================= */
const MODEL = "qwen/qwen3-235b-a22b";
const REQUEST_TIMEOUT = 12000; // 🔥 reduced
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

/* ================= 🔥 STRONG VALIDATION ================= */
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
  signal: AbortSignal,
  temperature: number
): Promise<string | null> {
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
        max_tokens: 1400, // 🔥 increased to prevent cut
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal,
    });

    const data: any = await res.json();

    return cleanResponse(
      data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        null
    );
  } catch (err) {
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

  /* ================= PRIMARY ================= */
  while (attempt < MAX_RETRIES && !response) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const raw = await callOpenRouter(prompt, controller.signal, 0.5);

      clearTimeout(timeout);

      if (isComplete(raw)) {
        response = finalize(raw);
        break;
      }

      /* 🔁 RETRY WITH FIX INSTRUCTION */
      const retryPrompt =
        prompt +
        "\n\nRespond clearly with complete sentences. Do not cut off.";

      const retry = await callOpenRouter(retryPrompt, controller.signal, 0.6);

      if (isComplete(retry)) {
        response = finalize(retry);
        break;
      }

    } catch (err) {
      console.warn(`[OpenRouter attempt ${attempt + 1} failed]`, err);
    }

    attempt++;
  }

  /* ================= CACHE ONLY GOOD ================= */
  if (response) {
    cache.set(cacheKey, response);
    return response;
  }

  return null; // 🔥 let upstream handle failure properly
}
