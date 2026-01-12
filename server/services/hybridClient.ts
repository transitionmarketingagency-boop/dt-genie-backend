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

/* ---------------- Keywords for complex prompts ---------------- */
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

/**
 * Determine if a prompt is complex enough to require Gemini
 */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;
  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some((word) => lower.includes(word));
}

/**
 * Hybrid response generator
 * - Simple prompts → Gemma (local, free)
 * - Complex prompts → Gemini (cloud, free tier)
 * - Automatic fallback if Gemma fails
 *
 * Accepts optional `context` string from vector store to improve answers
 */
export async function generateHybridResponse(
  prompt: string,
  context?: string
): Promise<string> {
  // Construct the full prompt with context if available
  const fullPrompt = context
    ? `Use the following context to answer the question professionally and concisely:\n${context}\nQuestion: ${prompt}`
    : `Answer professionally and concisely: ${prompt}`;

  try {
    // Use Gemma for simpler prompts first
    if (!isComplex(fullPrompt)) {
      const gemmaResponse = await generateGemma(fullPrompt);

      if (gemmaResponse && gemmaResponse.trim().length > 20) {
        // Return Gemma response if valid
        return gemmaResponse;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, falling back to Gemini:", err);
  }

  // Fallback to Gemini for complex prompts or if Gemma fails
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
