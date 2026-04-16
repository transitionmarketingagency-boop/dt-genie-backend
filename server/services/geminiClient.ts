import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as dotenv from "dotenv";
import { strategicBrain } from "./strategicBrain.js";
import crypto from "crypto";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ================= ENV ================= */
dotenv.config({ path: join(__dirname, "../../.env") });

const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;
const TIMEOUT = 12000;

const BOT_NAME = "DT Genie";

/* ================= CACHE ================= */
const cache = new Map<string, string>();

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
      .slice(0, 4000) || ""
  );
}

/* ================= VALIDATION ================= */
function isValidResponse(text: string | null | undefined): text is string {
  if (!text) return false;

  const t = text.trim();
  if (t.length < 40) return false;

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

function fixSpacing(text: string): string {
  return (text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureComplete(text: string): string {
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : text + ".";
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

  let contextText = "";

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(
        prompt.slice(0, 300),
        sessionId
      );

      contextText = `Stage: ${brainContext?.stage || "unknown"} | LeadScore: ${
        brainContext?.leadScore || 0
      }`;
    } catch {
      contextText = "";
    }
  }

  const highIntent = detectHighIntent(prompt);

  const finalPrompt = `
You are ${BOT_NAME}, a strategic marketing assistant.

Rules:
- Be precise and practical
- Avoid fluff
- No repetition
- Give actionable answers only

Context:
${contextText}

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
          maxOutputTokens: 900,
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

    return content;
  } catch (err: any) {
    console.warn("[Gemini Error]", err?.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ================= EXPORT ================= */
export const geminiClient = generateGemini;
