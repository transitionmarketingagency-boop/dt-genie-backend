// server/services/geminiClient.ts

import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { strategicBrain } from "./strategicBrain.js";
import crypto from "crypto";

/* ---------------- ESM PATHS ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- ENV ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- CONFIG ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;
const TIMEOUT = 12000;

/* ---------------- IDENTITY ---------------- */
const identityUrl = pathToFileURL(join(__dirname, "../system/identity.js")).href;
const { BOT_NAME } = await import(identityUrl);

/* ---------------- CACHE ---------------- */
const recentCache: Map<string, string> = new Map();

function hash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/* ---------------- TYPES ---------------- */
type SafeLeadScore = number | { total?: number } | undefined;

/* ---------------- PROMPT CLEAN ---------------- */
function cleanPrompt(prompt: string) {
  return (
    prompt
      ?.replace(/\s+/g, " ")
      .replace(/\x00/g, "")
      .trim()
      .slice(0, 4000) || ""
  );
}

/* ---------------- VALIDATION ---------------- */
function isValidResponse(text: string) {
  if (!text || text.length < 15) return false;

  const lower = text.toLowerCase();

  return ![
    "```",
    "<|",
    "|>",
    "assistant:",
    "system:",
    "undefined",
    "null",
    "error",
  ].some((s) => lower.includes(s));
}

function isFakeDelay(text: string): boolean {
  const t = text.toLowerCase();
  return [
    "temporary delay",
    "slight delay",
    "having trouble",
    "try again shortly",
  ].some((s) => t.includes(s));
}

function containsNonEnglish(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
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

function cleanResponse(text: string) {
  return (
    text
      ?.replace(/assistant:|system:/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\s+/g, " ")
      .trim() || ""
  );
}

/* ---------------- INTENT ---------------- */
function detectHighIntent(prompt: string): boolean {
  const text = prompt.toLowerCase();
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

/* ---------------- SAFE SCORE ---------------- */
function extractScore(score: SafeLeadScore): number {
  if (typeof score === "number") return score;
  if (typeof score === "object" && score !== null && "total" in score) {
    return typeof score.total === "number" ? score.total : 0;
  }
  return 0;
}

/* ---------------- MAIN FUNCTION ---------------- */
export async function generateGemini(
  prompt: string,
  sessionId?: string
): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return "";

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${hash(prompt)}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) return recentCache.get(cacheKey)!;

  /* ---------- CONTEXT ---------- */
  let contextText = "";

  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(
        prompt.slice(0, 300),
        sessionId
      );

      const stage = brainContext?.stage || "unknown";
      const score = extractScore(brainContext?.leadScore);

      contextText = `Context: stage=${stage}, score=${score.toFixed(2)}.`;
    } catch (err) {
      console.warn("[Gemini context failed]", err);
    }
  }

  const highIntent = detectHighIntent(prompt);

  /* ---------- FINAL PROMPT ---------- */
  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your job:
Give clear, specific, and practical marketing advice.

Rules:
- Answer exactly what the user asked
- Be concise but complete
- Avoid generic responses
- No fluff or filler
- No system talk
- No broken sentences

${contextText}

User:
${prompt}

Response:
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    console.log(`⚡ Gemini call (highIntent=${highIntent})`);

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

    clearTimeout(timeout);

    if (!res.ok) throw new Error(await res.text());

    const data: any = await res.json();

    let content =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    content = cleanResponse(content);

    /* ---------- VALIDATION ---------- */
    if (
      !isValidResponse(content) ||
      isFakeDelay(content) ||
      containsNonEnglish(content)
    ) {
      throw new Error("Rejected Gemini output");
    }

    content = fixSpacing(content);
    content = ensureComplete(content);

    /* ---------- CACHE ---------- */
    if (content.length > 30) {
      recentCache.set(cacheKey, content);
    }

    console.log("✅ Gemini success");
    return content;
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn("⚠️ Gemini failed:", err?.message || err);

    // IMPORTANT: return EMPTY so OpenRouter or hybrid fallback handles it
    return "";
  }
}

/* ---------------- EXPORT ---------------- */
export const geminiClient = generateGemini;
