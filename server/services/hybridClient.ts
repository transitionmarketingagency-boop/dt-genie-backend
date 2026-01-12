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

/* ---------------- Detect short/simple queries ---------------- */
function isSimpleQuery(prompt: string) {
  const greetings = ["hi", "hello", "hey", "yo", "good morning", "good afternoon"];
  return prompt.trim().length <= 20 || greetings.some((g) => prompt.toLowerCase().includes(g));
}

/* ---------------- Detect complex queries ---------------- */
function isComplex(prompt: string) {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some((word) => lower.includes(word));
}

/* ---------------- Hybrid response generator ---------------- */
export async function generateHybridResponse(prompt: string, context?: string): Promise<string> {
  const fullPrompt = context
    ? `Answer professionally and concisely using the following context:\n${context}\n\nQuestion: ${prompt}`
    : prompt;

  try {
    // Short/simple → Gemma
    if (!isComplex(fullPrompt) || isSimpleQuery(fullPrompt)) {
      const gemmaResponse = await generateGemma(fullPrompt);
      if (gemmaResponse && gemmaResponse.trim().length > 5) return gemmaResponse;
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, fallback to Gemini:", err);
  }

  // Fallback → Gemini for complex or failed Gemma
  try {
    const geminiResponse = await generateGemini(fullPrompt);
    return geminiResponse;
  } catch (err) {
    console.error("❌ Gemini failed:", err);
    return "I’m here to help, but something went wrong. Please try again later.";
  }
}

/* ---------------- Backward compatibility ---------------- */
export const hybridClient = generateHybridResponse;
