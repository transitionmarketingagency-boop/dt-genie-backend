// server/services/geminiClient.ts

import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, "../../.env") });

// ✅ CORRECT MODEL (THIS FIXES YOUR ERROR)
const MODEL_NAME = "models/gemini-1.5-flash";

export async function generateGemini(prompt: string): Promise<string> {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("❌ GEMINI_API_KEY missing in environment variables");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${MODEL_NAME}:generateContent?key=${API_KEY}`,
    {
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
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`❌ Gemini API Error ${response.status}: ${err}`);
  }

  const data = await response.json();

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "⚠️ Gemini returned no content."
  );
}

// Backward compatibility
export const geminiClient = generateGemini;
