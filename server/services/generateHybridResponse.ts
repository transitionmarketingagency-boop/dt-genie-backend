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

// ⚠️ FIX: safe fallback (prevents crash if import missing)
function cleanHybridResponse(text: string): string {
  if (!text) return "";
  return typeof cleanResponse === "function"
    ? cleanResponse(text).trim()
    : text.trim();
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

  const hasVectorKnowledge = Boolean(vectorText && vectorText.trim().length > 50);

  const knownContext = `
Known User Context:
${historyText || "No prior context available."}

Industry: ${brainContext?.strategicMemory?.industry ?? "unknown"}
Business Type: ${brainContext?.strategicMemory?.businessType ?? "unknown"}

IMPORTANT:
- Do NOT repeat questions already answered
- Move the conversation FORWARD with execution-focused thinking
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
- NEVER reset the conversation direction
- NEVER hallucinate when knowledge is available

- ALWAYS:
  → Use provided KNOWLEDGE FIRST (vector data is priority source)
  → Diagnose root problem precisely
  → Give SPECIFIC, EXECUTABLE actions
  → Tie everything to measurable outcomes (revenue, leads, ROAS)

🧠 INTELLIGENCE MODE
Execution Mode: ${brainContext?.executionMode ?? "exploration"}

IF executionMode = "execution":
- DO NOT ask unnecessary questions
- Focus on direct implementation steps

IF executionMode = "exploration":
- Diagnose deeply
- Ask MAX 1 high-value question ONLY if required

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

📚 KNOWLEDGE (PRIORITY SOURCE — DO NOT IGNORE)
${hasVectorKnowledge ? vectorText : "NO VECTOR DATA AVAILABLE — use general reasoning only"}

👤 USER MESSAGE
${message}

🧠 THINKING RULES
1. If KNOWLEDGE exists → ALWAYS prioritize it
2. If knowledge is missing → use strategic reasoning
3. Never mix both blindly
4. Always stay grounded in provided data

✍️ RESPONSE STRUCTURE
1. Identify the REAL problem (specific, not generic)
2. Provide a CLEAR EXECUTABLE solution
   - Steps
   - Tactics
   - Strategy tied to outcome
3. Optional: ONE sharp follow-up question ONLY if needed

🎯 FINAL RULES
- Be sharp, direct, and strategic
- Sound like a real consultant, not an AI
- Avoid fluff and repetition
- Prefer depth over surface advice
- If context exists → MOVE FORWARD, don’t reset
`.trim();
}


// ===================== HYBRID EXECUTION =====================

function isGoodResponse(text: unknown): text is string {
  if (typeof text !== "string") return false;

  const clean = text.trim();

  if (clean.length < 80) return false;
  if (clean.split(" ").length < 12) return false;
  if (!/[.?!]$/.test(clean)) return false;

  const badPatterns = [
    "you're trying to:",
    "something broke",
    "undefined",
    "i am an ai",
    "i'm an ai",
    "cannot process",
    "error occurred",
  ];

  return !badPatterns.some((p) =>
    clean.toLowerCase().includes(p)
  );
}

function shouldResetContext(message: string): boolean {
  const triggers = [
    "i run",
    "i have",
    "my business",
    "we are",
    "new idea",
    "different business",
    "starting a new",
  ];

  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

function repairResponse(text: string): string {
  let fixed = (text || "").trim();

  if (!fixed) return "";

  if (!/[.?!]$/.test(fixed)) {
    fixed += ".";
  }

  fixed = fixed.replace(/\s+/g, " ").trim();

  return fixed;
}

/* ===================== MAIN HYBRID EXECUTION ===================== */
export async function executeHybridResponse({
  sessionId,
  message,
  brainContext = {},
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
  brainContext: any;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  recentMessagesCache: any[];
  intentCategories: string[];
  forceNoQuestions?: boolean;
}) {
  try {
    const msg = (message || "").trim().toLowerCase();

    /* ================= ⚡ SMART GREETING ================= */
    if (/^(hi|hello|hey|yo)\b/.test(msg) && !historyText?.length) {
      const reply =
        "Hey — what are you trying to improve right now: traffic, conversions, or leads?";

      try {
        await memoryService.addMessage(sessionId, "assistant", reply);
      } catch {}

      return reply;
    }

    /* ================= HARD CONTEXT RESET ================= */
    if (shouldResetContext(message || "")) {
      brainContext = {
        ...(brainContext || {}),
        detectedServices: [],
        stage: "discovery",
        hasSufficientContext: false,
      };
    }

    /* ================= 1. SERVICE DETECTION ================= */
    try {
      const detectedServices = await detectService(message);

      brainContext.detectedServices = Array.isArray(detectedServices)
        ? detectedServices.filter((s: any) => typeof s === "string")
        : [];
    } catch {
      brainContext.detectedServices = [];
    }

    /* ================= 2. VECTOR CONTEXT ================= */
    let fusedChunksText = "";

    try {
      const chunks = await getFusedChunks(message, 3);

      fusedChunksText = (chunks || [])
        .filter(Boolean)
        .map((c: any) => c?.text)
        .filter(Boolean)
        .join("\n\n");
    } catch {
      fusedChunksText = "";
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

    /* ================= 4. PRIMARY MODEL ================= */
    try {
      const qwenResp = await withTimeout(
        generateOpenRouter(prompt, sessionId),
        18000
      );

      if (isGoodResponse(qwenResp)) {
        response = qwenResp;
      }
    } catch {}

    /* ================= 5. RETRY ================= */
    if (!response) {
      try {
        const retryPrompt = `${prompt}

IMPORTANT:
- Give a complete response
- Do NOT cut mid sentence
- End with a full sentence`;

        const retryResp = await withTimeout(
          generateOpenRouter(retryPrompt, sessionId),
          15000
        );

        if (isGoodResponse(retryResp)) {
          response = retryResp;
        }
      } catch {}
    }

    /* ================= 6. GEMINI FALLBACK ================= */
    if (!response && GEMINI_ENABLED && canUseGemini()) {
      try {
        const geminiResp = await withTimeout(
          generateGemini(prompt, sessionId),
          12000
        );

        if (isGoodResponse(geminiResp)) {
          response = geminiResp;
          markGeminiUsed?.();
        }
      } catch {}
    }

    /* ================= 7. FINAL FALLBACK ================= */
    if (!response) {
      response = `You're trying to improve something around "${message}".

Let's fix this step-by-step:

→ What is your biggest bottleneck right now?
- Traffic
- Conversions
- Leads

Answer that, and I’ll build a precise execution plan for you.`;
    }

    /* ================= 8. CLEANING ================= */
    response = cleanHybridResponse(response);
    response = repairResponse(response);

    if (forceNoQuestions) {
      response = response.replace(/\?/g, ".");
    }

    response = enforceBotName(response);

    /* ================= 9. CTA CONTROL ================= */
    if (
      shouldIncludeCTA(
        message,
        intentCategories,
        leadScoreValue,
        brainContext?.stage
      ) &&
      !response.toLowerCase().includes("execution plan")
    ) {
      response +=
        "\n\nIf you want, I can map this into a precise execution plan tailored to your business.";
    }

    /* ================= 10. SAVE ================= */
    try {
      await memoryService.addMessage(sessionId, "assistant", response);
    } catch {}

    return response;
  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);

    return `Something broke on my side — but I’ve got you.

Tell me your goal (traffic, leads, or sales), and I’ll guide you step-by-step.`;
  }
}
