import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { processResponse } from "../../responseOptimizer.js";
import { withTimeout } from "./timeoutHelper.js";

/* ================= TYPES ================= */
export type RoutedResponse = {
  text: string;
  usedModel: "openrouter" | "gemini" | "hybrid";
  qualityScore: number;
};

/* ================= MAIN ORCHESTRATOR ================= */
export async function modelRouter(params: {
  prompt: string;
  sessionId?: string;
}): Promise<RoutedResponse | null> {
  const { prompt, sessionId } = params;

  if (!prompt) return null;

  /* ================= STEP 1: OPENROUTER ================= */
  let primary: string | null = null;

  try {
    primary = await withTimeout(
      generateOpenRouter(prompt, sessionId),
      12000
    );
  } catch {
    primary = null;
  }

  if (!primary) {
    primary = "I couldn't generate a response right now. Please try again.";
  }

  /* ================= STEP 2: QUALITY CHECK ================= */
  const quality = processResponse(primary);

  let finalText = quality.optimized;
  let usedModel: RoutedResponse["usedModel"] = "openrouter";

  /* ================= STEP 3: GEMINI ESCALATION ================= */
  if (quality.quality.isWeak) {
    try {
      const gemini = await withTimeout(
        generateGemini(prompt, sessionId),
        9000
      );

      if (gemini && gemini.length > finalText.length) {
        finalText = gemini;
        usedModel = "gemini";
      } else if (gemini) {
        // hybrid merge (best of both)
        finalText = mergeResponses(finalText, gemini);
        usedModel = "hybrid";
      }
    } catch {
      // silent fail
    }
  }

  /* ================= FINAL CLEANUP ================= */
  finalText = processResponse(finalText).optimized;

  return {
    text: finalText,
    usedModel,
    qualityScore: quality.quality.score,
  };
}

/* ================= MERGE ENGINE ================= */
function mergeResponses(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;

  const aLen = a.length;
  const bLen = b.length;

  // keep more complete + structured answer
  if (bLen > aLen && bLen > 200) return b;

  if (aLen > bLen && aLen > 200) return a;

  return a + "\n\n" + b;
}
