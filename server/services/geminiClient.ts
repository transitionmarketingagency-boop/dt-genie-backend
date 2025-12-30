// server/services/geminiClient.ts
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, "../../.env") });

/**
 * Gemini REST API (v1beta REQUIRED)
 */
const MODEL_NAME =
  process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";

const GENERATE_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

/**
 * Generate text using Gemini
 */
export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY missing in .env");
  }

  const res = await fetch(`${GENERATE_ENDPOINT}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`❌ Gemini API Error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "⚠️ No response from Gemini"
  );
}

/** 🔁 Backward-compatible export (DO NOT REMOVE) */
export const geminiClient = generateGemini;
