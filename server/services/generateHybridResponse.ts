// ===================== IMPORTS ===================== //

// Core AI services
import { getFusedChunks } from "./intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { generateCTA } from "./ctaEngine.js";

// System utilities
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";


// ===================== PHASE 2 OPTIMIZER (SAFE LOADER) ===================== //

type ProcessResponseFn = (text: string) => {
  optimized: string;
  quality?: any;
};

let processResponse: ProcessResponseFn | null = null;
let optimizerLoaded = false; // ✅ FIX: prevent repeated dynamic imports

async function loadOptimizer(): Promise<ProcessResponseFn | null> {
  if (optimizerLoaded) return processResponse;

  optimizerLoaded = true;

  try {
    const mod: any = await import("../../responseOptimizer.js");
    const fn = mod?.processResponse;

    if (typeof fn === "function") {
      processResponse = fn;
      return processResponse;
    }

    processResponse = null;
    return null;
  } catch {
    processResponse = null;
    return null;
  }
}


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
import {
  GEMINI_ENABLED,
  canUseGemini,
  markGeminiUsed,
} from "./geminiManager.js";
import { withTimeout } from "./timeoutHelper.js";

// AI / reasoning layer
import { neuralBrain } from "./neuralBrain.js";
import {
  normalizeLeadScore,
  determineExecutionMode,
} from "./leadScoreHelper.js";


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


// ===================== SAFE HELPERS ===================== //

function cleanHybridResponse(text: string): string {
  if (!text) return "";
  return typeof cleanResponse === "function"
    ? cleanResponse(text).trim()
    : text.trim();
}


// ===================== PROMPT BUILDER ===================== //

export function buildHybridPrompt({
  brainContext,
  leadScoreValue,
  detectedIntentNames,
  vectorText,
  historyText,
  message,
  priorityInstruction,
}: {
  brainContext: BrainContext;
  leadScoreValue: number;
  detectedIntentNames: string[];
  vectorText: string;
  historyText: string;
  message: string;
  priorityInstruction?: string;
}) {

  const hasVectorKnowledge =
    Boolean(vectorText && vectorText.trim().length > 50);

  const executionMode = brainContext?.executionMode ?? "exploration";

  // ✅ FIX: prevent prompt overflow (truncation protection)
  const safeHistory = (historyText || "").slice(-1000);
  const safeVector = (vectorText || "").slice(0, 1200);
  const safeMessage = (message || "").slice(0, 800);

  return `
You are Neon Vision, the AI system of Digital Transition Marketing.

- Neon Vision = the AI
- Digital Transition Marketing = the company

Never confuse the two.

--------------------------------------------------

CRITICAL RULES (STRICT)

1. ONLY use the provided KNOWLEDGE when available
2. DO NOT make up services, tools, data, or claims
3. DO NOT invent services
4. DO NOT give external links or contacts

If knowledge is missing:
→ Give a safe, general answer

--------------------------------------------------

BUSINESS CONTEXT

Company: Digital Transition Marketing

Focus Areas:
- AI Automation
- Marketing Systems
- Lead Generation
- Content & Growth Strategy
- CGI & Real Estate Marketing

--------------------------------------------------

USER CONTEXT

Stage: ${brainContext?.stage ?? "unknown"}
Intent: ${detectedIntentNames?.join(", ") || "general"}
Lead Score: ${leadScoreValue?.toFixed(2) ?? "0.00"}

--------------------------------------------------

CONVERSATION HISTORY

${safeHistory || "None"}

--------------------------------------------------

KNOWLEDGE (PRIMARY SOURCE)

${hasVectorKnowledge ? safeVector : "NO DATA AVAILABLE"}

IMPORTANT:
- If KNOWLEDGE exists → BASE your answer on it
- Do NOT override it with assumptions

--------------------------------------------------

USER MESSAGE

${priorityInstruction || ""}

${safeMessage}

--------------------------------------------------

RESPONSE STYLE

- Clear, direct, practical
- No fluff
- Natural human tone

EXECUTION MODE:

${executionMode === "execution"
  ? "→ Be decisive, give direct recommendations"
  : "→ You may ask ONE smart question if needed"}

--------------------------------------------------

FINAL CHECK

- Based on knowledge?
- No hallucination?
- Complete?

`.trim();
}



// ===================== HYBRID EXECUTION ===================== //

function isGoodResponse(text: unknown): text is string {
  if (typeof text !== "string") return false;

  const clean = text.trim();
  const lower = clean.toLowerCase();

  if (clean.length < 80) return false;
  if (clean.split(" ").length < 12) return false;

  const badPatterns = [
    "you're trying to",
    "traffic conversions leads",
    "something broke",
    "undefined",
    "i am an ai",
    "i'm an ai",
    "error occurred",
    "@",
    "http",
    "www.",
    "intent:",
    "examples:",
    "response:",
    "faq [",
    "source:",
    "{",
    "}",
  ];

  if (badPatterns.some((p) => lower.includes(p))) return false;

  // 🔥 repetition guard
  const sentences = clean.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  if (sentences.length >= 2 && sentences[0] === sentences[1]) return false;

  return true;
}

function shouldResetContext(message: string): boolean {
  const triggers = [
    "i run",
    "i have",
    "my business",
    "we are",
    "new business",
    "starting a new",
    "different business",
  ];

  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

function repairResponse(text: string): string {
  let fixed = (text || "").trim();
  if (!fixed) return "";

  // ✅ FIX: better truncation recovery
  const looksCut =
    fixed.endsWith("of") ||
    fixed.endsWith("in") ||
    fixed.endsWith("and") ||
    fixed.length < 100;

  if (!/[.?!]$/.test(fixed) || looksCut) {
    fixed += ".";
  }

  if (fixed.length < 80) {
    fixed += " Let me know if you want me to go deeper on this.";
  }

  return fixed.replace(/\s+/g, " ").trim();
}

function sanitizeFinalOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  if (
    cleaned.includes('"intent"') ||
    cleaned.includes('"examples"') ||
    cleaned.includes('"response"') ||
    cleaned.includes("FAQ [") ||
    cleaned.includes("Source:")
  ) {
    return "Let me give you a clear answer based on your situation.\n\nCan you clarify your main goal right now?";
  }

  cleaned = cleaned.replace(/system is now operational.*$/i, "");

  cleaned = cleaned.replace(
    /\b(semrush|ahrefs|zapier|openai|chatgpt|gemini)\b/gi,
    ""
  );

  return cleaned.trim();
}

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

    // ================= ENTRY INTELLIGENCE =================

    const isFirstMessage = !historyText || historyText.length < 10;
    const isGreeting = /^(hi|hello|hey|yo)\b/.test(msg);

    // ✅ FIX: prevent greeting loop
    const lastUserMessage =
      recentMessagesCache?.slice(-1)?.[0]?.content?.toLowerCase() || "";

    const isRepeatGreeting =
      isGreeting && /^(hi|hello|hey|yo)\b/.test(lastUserMessage);

    const isHighIntent = leadScoreValue >= 0.7;

    const entryMode =
      isFirstMessage && isGreeting
        ? "onboarding"
        : isHighIntent
        ? "execution"
        : "continuation";

    const finalEntryMode = entryMode;

    // ✅ FIX: greeting only on FIRST message
    if (isFirstMessage && isGreeting && !isRepeatGreeting) {
      const reply =
        "Hey — tell me what you're trying to improve in your business right now.";

      await memoryService.addMessage(sessionId, "assistant", reply);
      return reply;
    }

    // ================= CONTEXT RESET =================

    const strongResetSignal =
      message.length > 80 &&
      /(new business|different business|start over|completely different)/i.test(
        message
      );

    if (strongResetSignal) {
      brainContext = {
        ...brainContext,
        detectedServices: [],
        stage: "discovery",
        hasSufficientContext: false,
      };
    }

    // ================= SERVICE DETECTION =================

    try {
      const detectedServices = await detectService(message);

      brainContext.detectedServices = Array.isArray(detectedServices)
        ? detectedServices.filter((s: any) => typeof s === "string")
        : [];
    } catch {
      brainContext.detectedServices = [];
    }

    // ================= VECTOR (PERFORMANCE SAFE) =================

    let fusedChunksText = "";

    const shouldUseRetrieval =
      message.length > 20 &&
      !isGreeting &&
      !/(who are you|what do you do)/i.test(message);

    if (shouldUseRetrieval) {
      try {
        const chunks = await getFusedChunks(message, 3);

        fusedChunksText = (chunks || [])
          .map((c: any) => c?.text)
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 1200);
      } catch {
        fusedChunksText = "";
      }
    }

    // ================= CONTEXT CONTROL (LIGHT FIX) =================

    const isNewTopic =
      shouldResetContext(message) ||
      (message.length > 50 && !message.toLowerCase().includes("that"));

    const safeHistoryText =
      isNewTopic || isGreeting
        ? ""
        : (historyText || "").slice(-1000); // balanced memory

    // ================= PROMPT =================

    const prompt = buildHybridPrompt({
      brainContext: {
        ...brainContext,
        entryMode: finalEntryMode,
      },
      leadScoreValue,
      detectedIntentNames,
      vectorText: fusedChunksText,
      historyText: safeHistoryText,
      message: message.trim(),
      priorityInstruction: `
IMPORTANT:
- Answer ONLY the latest USER MESSAGE
- Ignore previous questions unless explicitly referenced
- Do NOT continue old answers
`,
    });

    let response: string | null = null;

    // ================= PRIMARY MODEL =================

    try {
      const result = await withTimeout(
        generateOpenRouter(prompt, sessionId),
        9000
      );

      if (typeof result === "string") {
        const trimmed = result.trim();

        const looksCut =
          trimmed.endsWith("of") ||
          trimmed.endsWith("in") ||
          trimmed.endsWith("and");

        if (isGoodResponse(trimmed) && !looksCut) {
          response = trimmed;
        }
      }
    } catch {}

    // ================= GEMINI FALLBACK =================

    if (!response && GEMINI_ENABLED && canUseGemini()) {
      try {
        const result = await withTimeout(
          generateGemini(prompt, sessionId),
          7000
        );

        if (isGoodResponse(result)) {
          response = result;
          markGeminiUsed?.();
        }
      } catch {}
    }

    // ================= FINAL FALLBACK =================

    if (!response) {
      if (isGreeting) {
        response =
          "Hey — what are you trying to improve in your business right now?";
      } else if (message.length < 10) {
        response =
          "Can you give me a bit more detail so I can help properly?";
      } else {
        response =
          "Let me break this down properly based on what you shared.";
      }
    }

    // ================= CLEANING =================

    response = cleanHybridResponse(response);
    response = repairResponse(response);

    if (response.length < 100) {
      response += " Let me know if you want me to expand on this.";
    }

    // ================= OPTIMIZER (PERF FIX) =================

    try {
      const optimizer =
        message.length > 40 ? await loadOptimizer() : null;

      if (optimizer) {
        const result = optimizer(response || "");

        if (
          result &&
          typeof result === "object" &&
          typeof result.optimized === "string" &&
          isGoodResponse(result.optimized)
        ) {
          response = result.optimized;
        }
      }
    } catch {}

    // ================= SAFETY =================

    if (forceNoQuestions && typeof response === "string") {
      response = response.replace(/\?/g, ".");
    }

    // ================= BOT ENFORCEMENT =================

    response = sanitizeFinalOutput(response || "");
    response = enforceBotName(response || "");

    // ================= DUPLICATE PROTECTION =================

    try {
      const lastMessages = await memoryService.getRecentMessages(sessionId, 2);

      const lastBotMessage = lastMessages?.find(
        (m: any) => m.role === "assistant"
      )?.content;

      if (lastBotMessage && typeof response === "string") {
        const similarity =
          response.slice(0, 120) === lastBotMessage.slice(0, 120);

        if (similarity) {
          response =
            "Let me answer that more clearly.\n\n" + response;
        }
      }
    } catch {}

    // ================= CTA ENGINE =================

    const cta = generateCTA({
      message,
      stage: brainContext?.stage,
      leadScore: leadScoreValue,
      detectedServices: brainContext?.detectedServices,
    });

    // ================= CTA CONTROL =================

    const normalizedMsg = (message || "").toLowerCase();

    const isHighIntentMessage =
      /(book|hire|call|schedule|appointment|work with you|get started)/i.test(
        normalizedMsg
      );

    let safeResponse =
      typeof response === "string"
        ? response
        : String(response || "");

    const shouldAddCTA =
      typeof cta === "string" &&
      cta.trim().length > 0 &&
      safeResponse.length > 0 &&
      !detectBookingRejection(message) &&
      !isGreeting &&
      !/^(hi|hello|hey)\b/i.test(normalizedMsg) &&
      !safeResponse.toLowerCase().includes(cta.toLowerCase()) &&
      (
        (leadScoreValue >= 0.7 &&
          String(brainContext?.executionMode) === "execution") ||
        isHighIntentMessage
      );

    if (shouldAddCTA) {
      safeResponse = safeResponse.trim() + "\n\n" + cta.trim();
    }

    // ================= SAVE =================

    await memoryService.addMessage(sessionId, "assistant", safeResponse);

    return safeResponse;
  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);

    return "Something went wrong. Try rephrasing your question.";
  }
}
