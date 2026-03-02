// server/services/geminiClient.ts
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- Gemini config ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;
const TIMEOUT_MS = 30000; // 30s timeout

/* ---------------- Import identity helpers ---------------- */
const identityUrl = pathToFileURL(join(__dirname, "../system/identity.js")).href;
const { enforceBotName, BOT_NAME } = await import(identityUrl);

/**
 * Generate response from Gemini API
 */
export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("❌ GEMINI_API_KEY missing");

  const finalPrompt =
    prompt.length < 100
      ? `Answer briefly and professionally as ${BOT_NAME}:\n${prompt}`
      : `
You are ${BOT_NAME}, AI strategist at Digital Transition Marketing.

Answer professionally and confidently.

User question:
${prompt}

Answer:
`.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) throw new Error("Gemini returned empty response");

    return enforceBotName(text);
  } catch (err: any) {
    console.error("❌ Gemini API call failed:", err?.message || err);
    throw err;
  }
}

/* ---------------- Backward compatibility ---------------- */
export const geminiClient = generateGemini;
