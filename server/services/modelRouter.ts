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

/* ================= VALIDATOR ================= */
function isStrongResponse(text: string | null): boolean {
  if (!text) return false;

  const t = text.trim();

  if (t.length < 80) return false;
  if (t.split(" ").length < 12) return false;

  if (/undefined|error|something broke/i.test(t)) return false;

  return true;
}

/* ================= MAIN ORCHESTRATOR ================= */
export async function modelRouter(params: {
  prompt: string;
  sessionId?: string;
}): Promise<RoutedResponse | null> {
  const { prompt, sessionId } = params;

  if (!prompt) return null;

  let openrouterRes: string | null = null;
  let geminiRes: string | null = null;

  /* ================= STEP 1: OPENROUTER ================= */
  try {
    openrouterRes = await withTimeout(
      generateOpenRouter(prompt, sessionId),
      9000
    );
  } catch {
    openrouterRes = null;
  }

  /* ================= STEP 2: GEMINI ================= */
  try {
    geminiRes = await withTimeout(
      generateGemini(prompt, sessionId),
      9000
    );
  } catch {
    geminiRes = null;
  }

  /* ================= STEP 3: VALIDATION ================= */
  const openValid = isStrongResponse(openrouterRes);
  const geminiValid = isStrongResponse(geminiRes);

  let finalText = "";
  let usedModel: RoutedResponse["usedModel"] = "openrouter";

  /* ================= STEP 4: DECISION ================= */

  if (geminiValid && !openValid) {
    finalText = geminiRes!;
    usedModel = "gemini";
  } else if (openValid && !geminiValid) {
    finalText = openrouterRes!;
    usedModel = "openrouter";
  } else if (openValid && geminiValid) {
    // 🔥 pick better structured (longer but not bloated)
    finalText =
      geminiRes!.length > openrouterRes!.length
        ? geminiRes!
        : openrouterRes!;
    usedModel = "hybrid";
  } else {
    finalText =
      openrouterRes ||
      geminiRes ||
      "I couldn't generate a proper response. Try rephrasing.";
  }

  /* ================= STEP 5: OPTIMIZATION ================= */
  try {
    const optimized = processResponse(finalText);

    if (
      optimized &&
      typeof optimized.optimized === "string" &&
      optimized.optimized.length > 40
    ) {
      finalText = optimized.optimized;
    }
  } catch {}

  return {
    text: finalText,
    usedModel,
    qualityScore: finalText.length / 100, // simple proxy
  };
}
