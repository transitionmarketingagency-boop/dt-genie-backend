// server/services/geminiClient.ts
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { strategicBrain } from "./strategicBrain.js";

/* ---------------- ESM safe paths ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- Gemini config (OPTIMIZED) ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

/* ⚡ SPEED OPTIMIZATION */
const TIMEOUT = 16000;       // was 25000
const MAX_RETRIES = 0;       // ❌ removed retry delays

/* ---------------- Identity ---------------- */
const identityUrl = pathToFileURL(join(__dirname, "../system/identity.js")).href;
const { BOT_NAME } = await import(identityUrl);

/* ---------------- Cache ---------------- */
const recentCache: Map<string, string> = new Map();

/* ---------------- Fallback ---------------- */
const fallbackVariants = [
  "I’m having a temporary delay, but I can still guide you. Tell me a bit more about your goal.",
  "There’s a slight delay right now. Share your situation and I’ll help you move forward.",
  "I can still help you strategically — just tell me more about what you're trying to achieve."
];

/* ---------------- Validators ---------------- */
function isValidResponse(text: string) {
  if (!text || text.length < 25) return false;

  const badPatterns = [
    "```", "<|", "|>", "assistant:", "system:", "undefined", "null", "error"
  ];

  return !badPatterns.some((p) => text.toLowerCase().includes(p));
}

/* ---------------- Prompt Cleaner ---------------- */
function cleanPrompt(prompt: string) {
  return prompt
    ?.replace(/\s+/g, " ")
    .replace(/\x00/g, "")
    .trim()
    .slice(0, 4000) || "";
}

/* ---------------- LIGHT Response Cleaner (FAST) ---------------- */
function cleanResponse(text: string) {
  return text
    ?.replace(/assistant:|system:/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\s+/g, " ")
    .trim() || "";
}

/* ---------------- High Intent ---------------- */
function detectHighIntent(prompt: string): boolean {
  const text = prompt.toLowerCase();

  return [
    "hire", "book", "schedule", "call",
    "work with", "i want", "let's start",
    "ready to invest", "asap"
  ].some((s) => text.includes(s));
}

/* ---------------- MAIN FUNCTION ---------------- */
export async function generateGemini(prompt: string, sessionId?: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return "I’m unable to access AI systems right now, but I can still guide you if you share more details.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;

  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ⚡ NON-BLOCKING STRATEGIC CONTEXT */
  let contextText = "";

  if (sessionId) {
    strategicBrain(prompt.slice(0, 300), sessionId)
      .then(({ brainContext }) => {
        contextText = `Context: stage=${brainContext.stage}, score=${brainContext.leadScore}.`;
      })
      .catch(() => {});
  }

  const highIntent = detectHighIntent(prompt);

  /* 🔥 IMPROVED PROMPT (LESS GENERIC, MORE STRATEGIC) */
  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your job:
Help businesses grow using clear, practical, strategic marketing advice.

Rules:
- Be direct, clear, and natural (not robotic)
- Focus on solving the user's problem
- Do NOT use markdown, symbols, or formatting
- Do NOT give generic answers
- Do NOT hallucinate services or pricing
- Give actionable insights

${contextText}

User:
${prompt}

Response:
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    console.log(`⚡ Gemini fast-call (highIntent=${highIntent})`);

    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: {
          temperature: highIntent ? 0.4 : 0.3,
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

    if (!isValidResponse(content)) {
      throw new Error("Invalid Gemini response");
    }

    recentCache.set(cacheKey, content);

    console.log("✅ Gemini success (fast)");
    return content;

  } catch (err: any) {
    clearTimeout(timeout);

    console.warn("⚠️ Gemini failed:", err?.message || err);

    const fallback =
      fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)];

    recentCache.set(cacheKey, fallback);
    return fallback;
  }
}

/* ---------------- Compatibility ---------------- */
export const geminiClient = generateGemini;
