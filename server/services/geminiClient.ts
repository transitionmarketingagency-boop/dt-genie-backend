import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as dotenv from "dotenv";
import crypto from "crypto";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ================= ENV ================= */
dotenv.config({ path: join(__dirname, "../../.env") });

const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

// ⚡ REDUCED (major latency win)
const TIMEOUT = 5000;

const BOT_NAME = "DT Genie";

/* ================= CACHE ================= */
const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

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

/* ================= CLEAN PROMPT ================= */
function cleanPrompt(prompt: string) {
  return (
    prompt
      ?.replace(/\s+/g, " ")
      .replace(/\x00/g, "")
      .trim()
      .slice(0, 3500) || ""
  );
}

/* ================= VALIDATION ================= */
function isValidResponse(text: string | null | undefined): text is string {
  if (!text) return false;

  const t = text.trim();

  if (t.length < 80) return false;
  if (t.split(/\s+/).length < 12) return false;

  // ❌ block incomplete endings
  if (/(of|in|and|to|for|with|on|at)$/i.test(t)) return false;

  if (!/[.?!]$/.test(t)) return false;

  const badPatterns = [
    "```",
    "assistant:",
    "system:",
    "undefined",
    "error",
    "<|",
  ];

  const lower = t.toLowerCase();
  if (badPatterns.some((p) => lower.includes(p))) return false;

  return true;
}

/* ================= HELPERS ================= */
function fixSpacing(text: string): string {
  return (text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureComplete(text: string): string {
  if (!text) return "";
  return /[.?!]$/.test(text) ? text : text + ".";
}

/* ================= INTENT ================= */
function detectHighIntent(prompt: string): boolean {
  const text = (prompt || "").toLowerCase();
  return [
    "hire",
    "book",
    "schedule",
    "call",
    "work with",
    "i want",
    "ready",
  ].some((s) => text.includes(s));
}

/* ================= MAIN ================= */
export async function generateGemini(
  prompt: string,
  sessionId?: string
): Promise<string | null> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return null;

  prompt = cleanPrompt(prompt);
  if (!prompt) return null;

  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const highIntent = detectHighIntent(prompt);

  // 🔥 SIMPLIFIED (no strategicBrain = faster)
  const finalPrompt = `
You are ${BOT_NAME}, a strategic marketing assistant.

Rules:
- Be clear, practical, and complete
- No fluff, no repetition
- Do not cut sentences mid-way

User:
${prompt}

Answer:
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: {
          temperature: highIntent ? 0.45 : 0.35,
          maxOutputTokens: 700,
          topP: 0.9,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[Gemini HTTP Error]", res.status);
      return null;
    }

    const data: any = await res.json();

    const raw =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    if (!isValidResponse(raw)) return null;

    let content = fixSpacing(raw);
    content = ensureComplete(content);

    cache.set(cacheKey, content);
    maintainCache();

    return content;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[Gemini Timeout]");
    } else {
      console.warn("[Gemini Error]", err?.message || err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================= EXPORT ================= */
export const geminiClient = generateGemini;
