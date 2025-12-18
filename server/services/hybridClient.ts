// server/services/hybridClient.ts
import { generateGemma } from "./gemmaClient";
import { generateGemini } from "./geminiClient";

/**
 * Keywords that indicate complex/high-reasoning prompts
 */
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
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

/**
 * Hybrid response generator
 * - Simple prompts → Gemma (local, free)
 * - Complex prompts → Gemini (cloud, free tier)
 * - Automatic fallback if Gemma fails
 */
export async function generateHybridResponse(prompt: string): Promise<string> {
  try {
    if (!isComplex(prompt)) {
      const gemmaResponse = await generateGemma(prompt);
      if (gemmaResponse && gemmaResponse.trim().length > 20) {
        return gemmaResponse;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemma failed, falling back to Gemini:", err);
  }

  return generateGemini(prompt);
}
