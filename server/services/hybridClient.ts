import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";

/* ---------------- ESM-safe __filename & __dirname ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- Load .env ---------------- */
dotenv.config({ path: path.join(__dirname, "../.env") });

/* ---------------- Keywords for complex queries ---------------- */
const COMPLEX_KEYWORDS = [
  "strategy",
  "plan",
  "analyze",
  "analysis",
  "funnel",
  "campaign",
  "roadmap",
  "growth",
  "automation",
  "architecture",
  "system",
];

/* ---------------- Detect simple queries ---------------- */
function isSimpleQuery(prompt: string): boolean {
  return prompt.trim().length <= 20;
}

/* ---------------- Detect complex queries ---------------- */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some((word) => lower.includes(word));
}

/* ---------------- Hybrid response generator ---------------- */
export async function generateHybridResponse(
  prompt: string,
  context?: string
): Promise<string> {
  const fullPrompt = context
    ? `Context:\n${context}\n\nQuestion:\n${prompt}`
    : prompt;

  try {
    /* ---- Prefer Gemma for most queries ---- */
    if (!isComplex(fullPrompt)) {
      const gemmaResponse = await generateGemma(fullPrompt);
      if (gemmaResponse && gemmaResponse.trim().length > 10) {
        return gemmaResponse;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, falling back to Gemini:", err);
  }

  /* ---- Fallback to Gemini ---- */
  try {
    return await generateGemini(fullPrompt);
  } catch (err) {
    console.error("❌ Gemini failed:", err);
    return "I’m here to help, but something went wrong. Please try again later.";
  }
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
