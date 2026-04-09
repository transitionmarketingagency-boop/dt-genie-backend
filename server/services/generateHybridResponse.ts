// ===================== IMPORTS ===================== //
// Core AI services
import { getFusedChunks } from "./intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";

// System utilities
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";

// Intent & Service detection
import { detectIntent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";

// Strategic logic & lead handling
import { strategicBrain } from "./strategicBrain.js";
import bookingFlow from "../bookingFlow.js";
import { analyzeLeadSignals } from "./leadIntelligence.js";
import { shouldTriggerBooking } from "./bookingTrigger.js";

// Modular helpers
import { detectBookingRejection, shouldIncludeCTA } from "./responseDecision.js";
import { compressContext } from "./responseUtilities.js";
import { GEMINI_ENABLED, canUseGemini, markGeminiUsed } from "./geminiManager.js";
import { withTimeout } from "./timeoutHelper.js";

import { neuralBrain } from "./neuralBrain.js";
import { normalizeLeadScore, determineExecutionMode } from "./leadScoreHelper.js";

// ===================== TYPES ===================== //
export interface BrainContext {
  stage?: string;
  intent?: string;
  reasoning?: string;
  leadScore?: number;
  detectedServices?: string[];
  detectedIntents?: string[];
  hasSufficientContext?: boolean;
  strategicMemory?: {
    industry?: string;
    businessType?: string;
  };
  executionMode?: string;
  isFresh?: boolean;
}

// ===================== UTILITY HELPERS ===================== //
function isLowQuality(text: string): boolean {
  if (!text) return true;
  return text.split(" ").length < 3 || text.trim().length < 20;
}

function looksIncomplete(text: string): boolean {
  if (!text) return true;
  return !/[.?!]$/.test(text.trim());
}

function compressResponse(text: string): string {
  return text.length > 1200 ? text.slice(0, 1200) + "..." : text;
}

function cleanHybridResponse(text: string): string {
  return cleanResponse(text).trim();
}

// ===================== HYBRID PROMPT BUILDER ===================== //
export function buildHybridPrompt({
  brainContext,
  leadScoreValue,
  detectedIntentNames,
  vectorText,
  historyText,
  message,
}: {
  brainContext: BrainContext;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  message: string;
}) {
  const avoidQuestions =
    Boolean(brainContext?.hasSufficientContext) && brainContext?.stage !== "discovery";

  const knownContext = `
Known User Context:
${historyText || "No prior context available."}

Industry: ${brainContext?.strategicMemory?.industry ?? "unknown"}
Business Type: ${brainContext?.strategicMemory?.businessType ?? "unknown"}

IMPORTANT:
- Do NOT ask for information already provided
- Use this context to MOVE FORWARD (not repeat questions)
`.trim();

  return `
You are ${BOT_NAME}, a senior AI growth strategist from Digital Transition Marketing.

You think like a top 1% consultant — not a chatbot.

🔥 CORE OBJECTIVE
Solve the user's REAL business problem using strategy, not generic advice.

🚨 HARD RULES (NON-NEGOTIABLE)
- NEVER give generic advice
- NEVER repeat previous responses
- NEVER ignore provided context
- NEVER ask the same question again
- NEVER reset the conversation direction
- NEVER output vague frameworks without specificity

- ALWAYS:
  → Diagnose the ROOT problem
  → Give SPECIFIC, EXECUTABLE actions
  → Tie everything to RESULTS (revenue, leads, ROAS)

🧠 INTELLIGENCE MODE
Execution Mode: ${brainContext?.executionMode ?? "exploration"}

IF executionMode = "execution":
- DO NOT ask unnecessary questions
- Give DIRECT implementation steps
- Move toward action, plan, or next step

IF executionMode = "exploration":
- Diagnose deeply
- Ask MAX 1 high-value question (only if needed)

${avoidQuestions ? "CRITICAL: DO NOT ASK ANY QUESTIONS." : ""}

📊 USER CONTEXT
Stage: ${brainContext?.stage ?? "discovery"}
Lead Score: ${leadScoreValue?.toFixed(2) ?? "0.00"}
Intent: ${detectedIntentNames?.join(", ") || "general"}
Services: ${brainContext?.detectedServices?.join(", ") || "adaptive"}

Strategic Insight:
${brainContext?.reasoning ?? "No prior insight"}

User Maturity:
${leadScoreValue > 0.6 ? "HIGH INTENT (ready to act)" : "EXPLORING"}

🧩 KNOWN CONTEXT
${knownContext}

📚 KNOWLEDGE
${vectorText || "No vector knowledge available."}

👤 USER MESSAGE
${message}

🧠 THINKING INSTRUCTIONS
Before answering:

1. Identify the REAL underlying problem.
2. Determine the fastest path to measurable improvement.
3. Give exact, actionable steps tied to outcomes.

✍️ RESPONSE STRUCTURE

1. Identify the REAL problem (specific, not generic)
2. Provide a CLEAR, EXECUTABLE solution
   - Steps
   - Tactics
   - Strategy tied to outcome
3. Optional: ONE sharp follow-up question ONLY if necessary

🎯 FINAL RULES
- Be sharp, direct, and strategic
- Sound like a human expert
- Avoid fluff, filler, repetition
- Prefer depth over surface-level advice
- If context exists → MOVE FORWARD, don’t reset
`.trim();
}

// ===================== HYBRID EXECUTION ===================== //
export async function executeHybridResponse({
  sessionId,
  message,
  brainContext,
  leadScoreValue,
  detectedIntentNames,
  vectorText,
  historyText,
  recentMessagesCache,
  intentCategories,
  forceNoQuestions = false,
}: {
  sessionId: string;
  message: string;
  brainContext: BrainContext;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  recentMessagesCache: any[];
  intentCategories: string[];
  forceNoQuestions?: boolean;
}) {
  try {
    /* ================= 1. SERVICE DETECTION ================= */
    const detectedServices = await detectService(message);
    brainContext.detectedServices = Array.isArray(detectedServices)
      ? detectedServices.filter((s): s is string => typeof s === "string")
      : [];

    /* ================= 2. VECTOR CONTEXT ================= */
    let fusedChunksText = "";
    try {
      const chunks = await getFusedChunks(message, 3);
      fusedChunksText = chunks.map((c) => c.text).filter(Boolean).join("\n\n");
    } catch {}

    /* ================= 3. BUILD PROMPT ================= */
    const prompt = buildHybridPrompt({
      brainContext,
      leadScoreValue,
      detectedIntentNames,
      vectorText: fusedChunksText,
      historyText,
      message,
    });

    let response = "";
    let attempt = 0;

    /* ================= 4. PRIMARY: QWEN (RETRY) ================= */
    while (attempt < 2 && !response) {
      try {
        const qwenResp = await withTimeout(
          generateOpenRouter(prompt, sessionId),
          25000 // ✅ MATCH OpenRouter timeout
        );

        if (qwenResp && qwenResp.length > 20) {
          response = qwenResp;
          break;
        }
      } catch (err) {
        console.warn(`[Qwen attempt ${attempt + 1} failed]`, err);
      }

      attempt++;
    }

    /* ================= 5. SECONDARY: GEMINI ================= */
    if (!response && GEMINI_ENABLED && canUseGemini()) {
      try {
        const geminiResp = await withTimeout(
          generateGemini(prompt, sessionId),
          15000
        );

        if (geminiResp && geminiResp.length > 20) {
          response = geminiResp;
          markGeminiUsed();
        }
      } catch (err) {
        console.warn("[Gemini failed]", err);
      }
    }

    /* ================= 🚨 HARD FAIL ================= */
    if (!response) {
      throw new Error("ALL AI MODELS FAILED");
    }

    /* ================= 6. CLEAN ================= */
    response = cleanHybridResponse(response);

    if (forceNoQuestions) {
      response = response.replace(/\?+/g, ".");
    }

    response = enforceBotName(response);

    /* ================= 7. CTA ================= */
    if (
      shouldIncludeCTA(message, intentCategories, leadScoreValue, brainContext.stage)
    ) {
      response +=
        "\n\nWant me to map this into a step-by-step execution plan tailored to your business?";
    }

    /* ================= 8. SAVE ================= */
    await memoryService.saveMessage(sessionId, "assistant", response);

    return response;

  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);

    // ❌ NO STATIC RESPONSE
    throw err;
  }
}
