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

/* ================= QUALITY GATE ================= */
function isGoodResponse(text: string | null | undefined): text is string {
  if (!text) return false;

  const clean = text.trim();

  if (clean.length < 80) return false;
  if (!/[.?!]$/.test(clean)) return false;
  if (clean.includes("You're trying to:")) return false;
  if (clean.includes("Something broke")) return false;
  if (clean.includes("undefined")) return false;
  if (clean.split(" ").length < 12) return false;

  return true;
}

/* ================= CONTEXT RESET ================= */
function shouldResetContext(message: string): boolean {
  const triggers = ["i run", "i am a", "my business", "new idea", "different"];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

/* ================= RESPONSE REPAIR ================= */
function repairIfCut(text: string): string {
  const trimmed = text.trim();
  if (!/[.?!]$/.test(trimmed)) {
    return trimmed + ".";
  }
  return trimmed;
}

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
    const msg = message.trim().toLowerCase();

    /* ================= ⚡ SMART FAST PATH ================= */
    if (/^(hi|hello|hey|yo)\b/.test(msg) && !historyText) {
      const quickReply = `Hey — what are you trying to improve right now: traffic, conversions, or leads?`;
      await memoryService.saveMessage(sessionId, "assistant", quickReply);
      return quickReply;
    }

    /* ================= 🧠 CONTEXT RESET FIX ================= */
    if (shouldResetContext(message)) {
      brainContext.reasoning = "";
      brainContext.detectedServices = [];
      brainContext.intent = "fresh";
      brainContext.stage = "discovery";
    }

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
    } catch (err) {
      console.warn("[Vector failed]", err);
    }

    /* ================= 3. BUILD PROMPT ================= */
    const prompt = buildHybridPrompt({
      brainContext,
      leadScoreValue,
      detectedIntentNames,
      vectorText: fusedChunksText,
      historyText,
      message,
    });

    let response: string | null = null;

    /* ================= 4. PRIMARY (FAST QWEN) ================= */
    try {
      const qwenResp = await withTimeout(
        generateOpenRouter(prompt, sessionId),
        12000 // 🔥 reduced from 15s
      );

      if (isGoodResponse(qwenResp)) {
        response = qwenResp;
      }
    } catch (err) {
      console.warn("[Qwen failed]", err);
    }

    /* ================= 5. RETRY (ANTI-CUT FIX) ================= */
    if (!response) {
      try {
        const retryPrompt = prompt + "\n\nRespond clearly with complete sentences. Do not cut off.";

        const retryResp = await withTimeout(
          generateOpenRouter(retryPrompt, sessionId),
          8000
        );

        if (isGoodResponse(retryResp)) {
          response = retryResp;
        }
      } catch (err) {
        console.warn("[Qwen retry failed]", err);
      }
    }

    /* ================= 6. GEMINI FALLBACK ================= */
    if (!response && GEMINI_ENABLED && canUseGemini()) {
      try {
        const geminiResp = await withTimeout(
          generateGemini(prompt, sessionId),
          10000
        );

        if (isGoodResponse(geminiResp)) {
          response = geminiResp;
          markGeminiUsed();
        }
      } catch (err) {
        console.warn("[Gemini failed]", err);
      }
    }

    /* ================= 🚨 HARD FAIL (NO BAD FALLBACKS) ================= */
    if (!response) {
      throw new Error("All models failed quality check");
    }

    /* ================= 7. CLEAN + REPAIR ================= */
    response = cleanHybridResponse(response);
    response = repairIfCut(response);

    if (forceNoQuestions) {
      response = response.replace(/\?+/g, ".");
    }

    response = enforceBotName(response);

    /* ================= 8. CTA CONTROL ================= */
    if (
      shouldIncludeCTA(message, intentCategories, leadScoreValue, brainContext.stage) &&
      !response.toLowerCase().includes("execution plan")
    ) {
      response +=
        "\n\nIf you want, I can map this into a precise execution plan for your business.";
    }

    /* ================= 9. SAVE ================= */
    await memoryService.saveMessage(sessionId, "assistant", response);

    return response;

  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);

    // ❌ NO TEMPLATE FALLBACK (removes your current problem)
    throw err;
  }
}
