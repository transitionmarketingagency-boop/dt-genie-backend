// server/services/geminiClient.ts

import * as dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- Import identity helpers ---------------- */
const { enforceBotName } = await import(
  pathToFileURL(join(__dirname, "../system/identity.js")).href
);

/* ---------------- Gemini config ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

/**
 * Generate response from Gemini API
 * - Short prompts (<100 chars) respond instantly
 * - Long prompts use full professional instructions
 */
export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY missing. Add it to your .env");
  }

  // ⚡ Short vs long prompt optimization
  const finalPrompt =
    prompt.length < 100
      ? `Answer briefly and professionally as Neon Vision:\n${prompt}`
      : `
You are Neon Vision, AI strategist at Digital Transition Marketing.

You help businesses with:
- Digital marketing
- Growth strategy
- Automation
- AI tools
- Lead generation
- Branding
- Funnels

Be professional, confident, helpful.
Do NOT repeat your name unless explicitly asked.

User question:
${prompt}

Answer:
`.trim();

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        // Retry on 503 up to maxRetries
        if (res.status === 503 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw new Error(`Gemini API Error ${res.status}: ${err}`);
      }

      const data: any = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response";

      return enforceBotName(text.trim(), prompt);
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
  }

  throw new Error("Gemini failed after retries");
}

/* ---------------- Backward compatibility ---------------- */
export const geminiClient = generateGemini;
