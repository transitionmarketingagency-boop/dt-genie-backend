import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import { enforceBotName } from "../system/identity.js";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- Gemini config ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY missing.");
  }

  /* ✅ Identity MUST be injected directly */
  const finalPrompt = `
You are Neon Vision, the AI strategist for Digital Transition Marketing.

You help businesses with:
- Digital marketing
- Growth strategy
- Automation
- AI tools
- Lead generation
- Branding
- Funnels

Be professional, confident, and helpful.
Do NOT repeat your name unless explicitly asked.

User question:
${prompt}

Answer:
`.trim();

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: finalPrompt }] }]
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No response generated.";

  return enforceBotName(text.trim(), prompt);
}

/* ---------------- Backward compatibility ---------------- */
export const geminiClient = generateGemini;
