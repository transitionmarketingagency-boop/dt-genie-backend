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
  "I'm having some trouble generating a detailed response right now, but I can still guide you. Could you provide a bit more context about your goal?",
  "Apologies, AI response is delayed. Please describe your needs in more detail so I can assist effectively.",
  "Temporary issue with AI processing. Share more details about your project, and I’ll provide actionable guidance."
];

/* ---------------- Validators & Cleaners ---------------- */
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
    "traceback",
  ];
  return !badPatterns.some((p) => text.toLowerCase().includes(p));
}

function cleanPrompt(prompt: string) {
  if (!prompt) return "";
  return prompt.replace(/\s+/g, " ").replace(/\x00/g, "").trim().slice(0, 4800);
}

function cleanResponse(text: string) {
  if (!text) return "";
  let cleaned = text
    .replace(/assistant:/gi, "")
    .replace(/system:/gi, "")
    .replace(/#{1,}/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*/g, "")
    .replace(/_{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Remove accidental contact info
  cleaned = cleaned.replace(/(?:contact|email|phone|call me|reach me)/gi, "");

  // Minor spelling fixes for common marketing terms
  cleaned = cleaned.replace(/\bbusines\b/gi, "business");
  cleaned = cleaned.replace(/\baproach\b/gi, "approach");
  cleaned = cleaned.replace(/\bmesaging\b/gi, "messaging");
  cleaned = cleaned.replace(/\btrafic\b/gi, "traffic");
  cleaned = cleaned.replace(/\bfunnel\b/gi, "funnel");

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
    "fast start",
  ];
  return signals.some((s) => text.includes(s));
}

/* ---------------- Main Gemini generation ---------------- */
export async function generateGemini(prompt: string, sessionId?: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    return "Apologies, I cannot access AI systems currently, but I can still provide guidance.";
  }

  prompt = cleanPrompt(prompt);
  const cacheKey = `${sessionId || "global"}:${prompt}`;
  if (recentCache.has(cacheKey)) return recentCache.get(cacheKey)!;

  /* ---------------- Strategic Brain & Context ---------------- */
  let contextText = "";
  if (sessionId) {
    try {
      const [brainContextResult] = await Promise.all([
        strategicBrain(prompt.slice(0, 500), sessionId)
      ]);

      const { brainContext, chunks } = brainContextResult;
      const pricingChunk = chunks?.find((c: any) => c.intent?.toLowerCase().includes("pricing"));
      const pricingInfo = pricingChunk ? pricingChunk.text : "Pricing info not available.";

      contextText = `Context: User stage=${brainContext.stage}, leadScore=${brainContext.leadScore}, recommendedService=${brainContext.recommendedService}. Pricing info: ${pricingInfo}. `;
    } catch (err) {
      console.warn("⚠️ strategicBrain fetch failed:", err);
    }
  }

  const highIntent = detectHighIntent(prompt);
  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your role is to assist businesses using the 14 core services offered by Digital Transition Marketing.

Guidelines:
- Only promote the company's services.
- Never recommend external platforms or third-party tools.
- Explain external tools briefly if mentioned, then guide to company solutions.
- Respond in clear, professional natural language without markdown, headings, emojis, or code symbols.
- Provide actionable, context-aware guidance aligned with user intent.
- Maintain factual accuracy and rely only on company knowledge.
- Never provide contact info or fake details.
- You MUST answer exactly what the user asked. Do not switch topics.
- If the question is specific, give a direct and detailed answer.
- Never reuse previous responses or generic templates.

${contextText}
User request:
${prompt}

Provide a concise, relevant, professional response.
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
            topP: highIntent ? 0.95 : 0.9,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const data: any = await res.json();
      let content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      content = cleanResponse(content);

      if (!content || !isValidResponse(content)) throw new Error("Gemini invalid or empty response");

      // Avoid repeated responses in session
      if (variationCache.has(cacheKey)) content += " ";
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
  const fallback = fallbackVariants[Math.floor(Math.random() * fallbackVariants.length)];
  recentCache.set(cacheKey, fallback);
  return fallback;
}

/* ---------------- Backwards compatibility ---------------- */
export const geminiClient = generateGemini;
