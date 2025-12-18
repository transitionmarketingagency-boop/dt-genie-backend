// server/services/hybridRouter.ts
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";

/**
 * Keywords that indicate complex / high-reasoning prompts
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
 * Decide whether a prompt is complex
 */
function isComplex(prompt: string): boolean {
  if (prompt.length > 300) return true;

  const lower = prompt.toLowerCase();
  return COMPLEX_KEYWORDS.some(word => lower.includes(word));
}

/**
 * ✅ MAIN HYBRID EXPORT
 * Simple → Gemma (local)
 * Complex → Gemini (cloud)
 * Auto-fallback
 */
export async function generateHybridResponse(
  prompt: string
): Promise<string> {
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
