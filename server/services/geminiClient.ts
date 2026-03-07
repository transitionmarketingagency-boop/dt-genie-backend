// server/services/geminiClient.ts
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

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
  if (!text) return false;

  if (text.length < 20) return false;

  const bad = ["```", "###", "<|", "|>", "assistant:", "system:"];

  for (const p of bad) {
    if (text.includes(p)) return false;
  }

  return true;
}

/* ---------------- Clean prompt ---------------- */

function cleanPrompt(prompt: string) {
  if (!prompt) return "";

  return prompt
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3500);
}

/* ---------------- Main Gemini generation ---------------- */

export async function generateGemini(
  prompt: string
): Promise<string> {

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    return "";
  }

  prompt = cleanPrompt(prompt);

  const finalPrompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Answer professionally and clearly.

If the user asks about services, marketing, AI, business growth, or Digital Transition Marketing, answer with confidence.

User question:
${prompt}

Answer:
`.trim();

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= MAX_RETRIES) {

    attempt++;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    try {

      console.log(`⚡ Gemini fallback attempt ${attempt}`);

      const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${text}`);
      }

      const data: any = await res.json();

      const content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!content) {
        throw new Error("Gemini empty response");
      }

      if (!isValidResponse(content)) {
        throw new Error("Gemini invalid response");
      }

      console.log("✅ Gemini success");

      return enforceBotName(content);

    } catch (err: any) {

      clearTimeout(timeout);

      lastError = err;

      console.warn(`⚠️ Gemini attempt ${attempt} failed:`, err.message);

      if (attempt <= MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  console.error("❌ Gemini failed completely:", lastError);

  return "";
}

/* ---------------- Backwards compatibility ---------------- */

export const geminiClient = generateGemini;
