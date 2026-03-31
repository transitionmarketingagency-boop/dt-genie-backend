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

/* ---------------- Gemini config ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;
const TIMEOUT = 25000;
const MAX_RETRIES = 2;

/* ---------------- Import identity helpers ---------------- */
const identityUrl = pathToFileURL(join(__dirname, "../system/identity.js")).href;
const { BOT_NAME } = await import(identityUrl);

/* ---------------- Caching ---------------- */
const recentCache: Map<string, string> = new Map();
const variationCache: Map<string, number> = new Map();

/* ---------------- Fallback variants ---------------- */
const fallbackVariants = [
  "I'm currently having trouble generating a response, but I can still guide you. Tell me a bit more about your goal.",
  "Apologies, there’s a temporary delay. Share your goal and I’ll help you move forward.",
  "There’s a temporary issue with AI processing. Describe your situation and I’ll guide you step by step."
];

/* ---------------- Validators ---------------- */
function isValidResponse(text: string) {
  if (!text || text.length < 25) return false;

  const badPatterns = [
    "```",
    "###",
    "<|",
    "|>",
    "assistant:",
    "system:",
    "undefined",
    "null",
    "error",
    "traceback"
  ];

  return !badPatterns.some((p) => text.toLowerCase().includes(p));
}

/* ---------------- Prompt Cleaner ---------------- */
function cleanPrompt(prompt: string) {
  if (!prompt) return "";
  return prompt
    .replace(/\s+/g, " ")
    .replace(/\x00/g, "")
    .trim()
    .slice(0, 4800);
}

/* ---------------- SAFE Response Cleaner ---------------- */
function cleanResponse(text: string) {
  if (!text) return "";

  let cleaned = text;

  /* ===== REMOVE INTERNAL TOKENS ===== */
  cleaned = cleaned
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "");

  /* ===== REMOVE MARKDOWN SAFELY ===== */
  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/_{2,}(.*?)_{2,}/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

  /* ===== REMOVE CONTROL CHARACTERS ===== */
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* ===== NORMALIZE WHITESPACE ===== */
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/* ---------------- High-intent detection ---------------- */
function detectHighIntent(prompt: string): boolean {
  if (!prompt) return false;

  const text = prompt.toLowerCase();

  const signals = [
    "hire",
    "book",
    "schedule",
    "consultation",
    "call",
    "work with",
    "i want",
    "sign up",
    "let's start",
    "ready to invest",
    "asap",
    "fast start"
  ];

  return signals.some((s) => text.includes(s));
}

/* ---------------- Main Gemini generation ---------------- */
export async function generateGemini(prompt: string, sessionId?: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    return "I’m unable to access AI systems right now, but I can still guide you if you share more details.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;

  if (recentCache.has(cacheKey)) {
    return recentCache.get(cacheKey)!;
  }

  /* ---------------- Strategic Brain Context ---------------- */
  let contextText = "";

  if (sessionId) {
    try {
      const [brainContextResult] = await Promise.all([
        strategicBrain(prompt.slice(0, 500), sessionId)
      ]);

      const { brainContext, chunks } = brainContextResult;

      const pricingChunk = chunks?.find(
        (c: any) => c?.intent?.toLowerCase?.().includes("pricing") && c?.text
      );

      const pricingInfo = pricingChunk
        ? pricingChunk.text
        : "Pricing info not available.";

      contextText = `Context: stage=${brainContext.stage}, leadScore=${brainContext.leadScore}, service=${brainContext.recommendedService}. ${pricingInfo}`;
    } catch (err) {
      console.warn("⚠️ strategicBrain fetch failed:", err);
    }
  }

  const highIntent = detectHighIntent(prompt);

  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your role is to help businesses grow using AI-powered marketing systems.

Guidelines:
- Be clear, natural, and professional
- Focus on solving the user’s problem
- Do not use markdown, symbols, or formatting
- Do not provide contact details
- Answer exactly what the user asked

${contextText}

User request:
${prompt}

Provide a clear, concise, helpful response.
`.trim();

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= MAX_RETRIES) {
    attempt++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      console.log(`⚡ Gemini attempt ${attempt} (highIntent=${highIntent})`);

      const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: highIntent ? 0.42 : 0.35,
            maxOutputTokens: 1000,
            topP: highIntent ? 0.95 : 0.9
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data: any = await res.json();

      let content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      content = cleanResponse(content);

      if (!content || !isValidResponse(content)) {
        throw new Error("Gemini invalid or empty response");
      }

      // Slight variation to prevent repetition
      if (variationCache.has(cacheKey)) {
        content = `${content} `;
      }

      variationCache.set(cacheKey, (variationCache.get(cacheKey) || 0) + 1);

      recentCache.set(cacheKey, content);

      console.log("✅ Gemini success");
      return content;

    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;

      console.warn(`⚠️ Gemini attempt ${attempt} failed:`, err?.message ?? err);

      if (attempt <= MAX_RETRIES) {
        const delay = 1500 * attempt;
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  console.error("❌ Gemini failed completely:", lastError);

  const fallback =
    fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)];

  recentCache.set(cacheKey, fallback);
  return fallback;
}

/* ---------------- Backwards compatibility ---------------- */
export const geminiClient = generateGemini;
