// server/services/geminiClient.ts

import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { strategicBrain } from "./strategicBrain.js";

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

/* ---------------- PROMPT CLEAN ---------------- */
function cleanPrompt(prompt: string) {
  return prompt
    ?.replace(/\s+/g, " ")
    .replace(/\x00/g, "")
    .trim()
    .slice(0, 4000) || "";
}

/* ---------------- VALIDATION ---------------- */

function isValidResponse(text: string) {
  if (!text || text.length < 15) return false;

  const lower = text.toLowerCase();

  if (
    lower.includes("```") ||
    lower.includes("<|") ||
    lower.includes("|>") ||
    lower.includes("assistant:") ||
    lower.includes("system:") ||
    lower.includes("undefined") ||
    lower.includes("null") ||
    lower.includes("error")
  ) {
    return false;
  }

  return true;
}

function isFakeDelay(text: string): boolean {
  const t = text.toLowerCase();

  return (
    t.includes("temporary delay") ||
    t.includes("slight delay") ||
    t.includes("having trouble") ||
    t.includes("try again shortly") ||
    t.includes("i can still guide you")
  );
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
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- CLEAN RESPONSE ---------------- */
function cleanResponse(text: string) {
  return text
    ?.replace(/assistant:|system:/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim() || "";
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
    "let's start",
    "ready"
  ].some((s) => text.includes(s));
}

/* ---------------- MAIN FUNCTION ---------------- */
export async function generateGemini(
  prompt: string,
  sessionId?: string
): Promise<string> {

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return "";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;

  /* ---------- CACHE ---------- */
  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ---------- CONTEXT (NON-BLOCKING) ---------- */
  let contextText = "";

  if (sessionId) {
    strategicBrain(prompt.slice(0, 300), sessionId)
      .then(({ brainContext }) => {
        contextText = `Context: stage=${brainContext.stage}, score=${brainContext.leadScore}.`;
      })
      .catch(() => {});
  }

  const highIntent = detectHighIntent(prompt);

  /* ---------- PROMPT ---------- */
  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your job:
Give clear, specific, and practical marketing advice.

Rules:
- Answer exactly what the user asked
- Be concise but complete
- Avoid generic responses
- Do NOT mention delays, errors, or system issues
- Do NOT output broken or incomplete sentences
- Focus on solving real business problems

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
          maxOutputTokens: 800,
          topP: 0.9
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(await res.text());

    const data: any = await res.json();

    let content =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    content = cleanResponse(content);

    /* ---------- HARD VALIDATION ---------- */
    if (
      !isValidResponse(content) ||
      isFakeDelay(content) ||
      containsNonEnglish(content)
    ) {
      throw new Error("Rejected bad Gemini output");
    }

    content = fixSpacing(content);
    content = ensureComplete(content);

    /* ---------- CACHE CLEAN ONLY ---------- */
    recentCache.set(cacheKey, content);

    console.log("✅ Gemini success");
    return content;

  } catch (err: any) {
    clearTimeout(timeout);

    console.warn("⚠️ Gemini failed:", err?.message || err);

    // ⚠️ NO MORE FAKE FALLBACKS
    return "";
  }
}

/* ---------------- EXPORT ---------------- */
export const geminiClient = generateGemini;
