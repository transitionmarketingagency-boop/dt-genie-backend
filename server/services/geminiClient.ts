import * as dotenv from "dotenv";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";

/* ---------------- ESM-safe __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ---------------- Load .env from project root ---------------- */
dotenv.config({ path: join(__dirname, "../../.env") });

/* ---------------- Windows-safe dynamic import ---------------- */
const { BOT_IDENTITY, enforceBotName } = await import(
  pathToFileURL(join(__dirname, "../system/identity.ts")).href
);

/* ---------------- Gemini config ---------------- */
const MODEL = "models/gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) throw new Error("❌ GEMINI_API_KEY missing. Add it to your .env in project root.");

  const finalPrompt = `
${BOT_IDENTITY}
User request: "${prompt}"
Respond as Neon Vision from Digital Transition Marketing.
`.trim();

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (res.status === 503 && attempt < maxRetries) {
          console.warn(`Gemini 503, retrying attempt ${attempt}...`);
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw new Error(`❌ Gemini API Error ${res.status}: ${err}`);
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Gemini returned no content.";
      return enforceBotName(text);
    } catch (e) {
      if (attempt === maxRetries) throw e;
    }
  }

  throw new Error("Gemini failed after 3 attempts");
}

/* ---------------- Backward compatibility ---------------- */
export const geminiClient = generateGemini;
