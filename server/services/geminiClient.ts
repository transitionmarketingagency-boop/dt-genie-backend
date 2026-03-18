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
const TIMEOUT = 12000;
const MAX_RETRIES = 1;

/* ---------------- Import identity helpers ---------------- */
const identityUrl = pathToFileURL(join(__dirname, "../system/identity.js")).href;
const { enforceBotName, BOT_NAME } = await import(identityUrl);

/* ---------------- Response validator ---------------- */
function isValidResponse(text: string) {
  if (!text || text.length < 25) return false;
  const badPatterns = ["```", "###", "<|", "|>", "assistant:", "system:", "undefined", "null", "error", "traceback"];
  return !badPatterns.some((p) => text.toLowerCase().includes(p));
}

/* ---------------- Clean prompt ---------------- */
function cleanPrompt(prompt: string) {
  if (!prompt) return "";
  return prompt
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4500);
}

/* ---------------- High-intent detection ---------------- */
function detectHighIntent(prompt: string): boolean {
  if (!prompt) return false;
  const text = prompt.toLowerCase();
  const signals = ["hire", "book", "schedule", "consultation", "call", "work with", "i want", "sign up", "let's start"];
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

  // Integrate strategicBrain context if sessionId provided
  let contextText = "";
  if (sessionId) {
    try {
      const { brainContext } = await strategicBrain(prompt, sessionId);
      contextText = `Context: User stage=${brainContext.stage}, leadScore=${brainContext.leadScore}, recommendedService=${brainContext.recommendedService}. `;
    } catch (err) {
      console.warn("⚠️ strategicBrain context fetch failed:", err);
    }
  }

  const highIntent = detectHighIntent(prompt);

  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Your role is to assist businesses using the 14 core services offered by Digital Transition Marketing.

Guidelines:
- Only promote the company's services.
- Never recommend external platforms or third-party tools (Kling, Midjourney, Runway, Pika, OpenAI, etc.).
- Explain external tools briefly if mentioned, then guide to company solutions.
- Respond in clear, professional natural language without markdown, headings, emojis, or code symbols.
- Provide actionable, context-aware guidance aligned with user intent.
- Maintain factual accuracy and rely only on company knowledge.

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
            maxOutputTokens: 600,
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
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!content) throw new Error("Gemini empty response");
      if (!isValidResponse(content)) throw new Error("Gemini invalid response");

      console.log("✅ Gemini success");
      return enforceBotName(content);

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
  return "I'm having trouble generating a response right now, but I can still provide guidance.";
}

/* ---------------- Backwards compatibility ---------------- */
export const geminiClient = generateGemini;
