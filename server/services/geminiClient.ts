// server/services/geminiClient.ts

import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, "../../.env") });

// ✅ CORRECT MODEL + ENDPOINT
const MODEL = "models/gemini-1.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateContent`;

export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY missing");
  }

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`❌ Gemini API Error ${res.status}: ${err}`);
  }

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "⚠️ Gemini returned no content"
  );
}

// backward compatibility
export const geminiClient = generateGemini;
