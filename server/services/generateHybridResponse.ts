// ===================== IMPORTS ===================== //

// Core AI services
import { getFusedChunks } from "./intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";

// System utilities
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";


// ===================== PHASE 2 OPTIMIZER (SAFE LOADER) ===================== //

type ProcessResponseFn = (text: string) => {
  optimized: string;
  quality?: any;
};

let processResponse: ProcessResponseFn | null = null;

async function loadOptimizer(): Promise<ProcessResponseFn | null> {
  if (processResponse) return processResponse;

  try {
    // ✅ FIXED: correct NodeNext relative path from server/services → root
    const mod: any = await import("../../responseOptimizer.js");

    const fn = mod?.processResponse;

    if (typeof fn === "function") {
      processResponse = fn;
      return processResponse;
    }

    processResponse = null;
    return null;
  } catch (err) {
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

function removeForbiddenContent(text: string): string {
  if (!text) return "";

  return text
    // ❌ remove emails
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, "")
    // ❌ remove links
    .replace(/https?:\/\/\S+/gi, "")
    // ❌ remove tool mentions
    .replace(/\b(semrush|ahrefs|zapier|openai|chatgpt|gemini|activepieces|salesforce|hubspot)\b/gi, "")
    .trim();
}


// ===================== PROMPT BUILDER ===================== //

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

  const hasVectorKnowledge =
    Boolean(vectorText && vectorText.trim().length > 50);

  const executionMode = brainContext?.executionMode ?? "exploration";

  return `
You are an AI assistant representing Digital Transition Marketing.

Your role is to provide accurate, grounded, and business-relevant answers.

--------------------------------------------------

CRITICAL RULES (STRICT)

1. ONLY use the provided KNOWLEDGE when available
2. DO NOT make up services, tools, data, or claims
3. DO NOT mention tools, platforms, or software unless explicitly in knowledge
4. DO NOT give contact details, emails, or external links
5. DO NOT invent statistics, case studies, or numbers
6. DO NOT act like a “guru” or “strategist personality”
7. DO NOT ask repetitive or unnecessary questions

If knowledge is missing:
→ Give a safe, general answer WITHOUT fabricating details

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

Industry: ${brainContext?.strategicMemory?.industry ?? "unknown"}
Business Type: ${brainContext?.strategicMemory?.businessType ?? "unknown"}

--------------------------------------------------

CONVERSATION HISTORY

${historyText || "None"}

--------------------------------------------------

KNOWLEDGE (PRIMARY SOURCE)

${hasVectorKnowledge ? vectorText : "NO DATA AVAILABLE"}

IMPORTANT:
- If KNOWLEDGE exists → BASE your answer on it
- Do NOT ignore it
- Do NOT override it with assumptions

--------------------------------------------------

USER MESSAGE

${message}

--------------------------------------------------

RESPONSE RULES

- Be clear, direct, and practical
- No fluff, no hype language
- No fake frameworks
- No unnecessary complexity
- Keep it natural and human

STRUCTURE:

1. Direct answer to the question
2. Short explanation (based on knowledge if available)
3. Practical next step (only if useful)

If executionMode = "execution":
→ Give direct actionable steps
→ Do NOT ask questions

If executionMode = "exploration":
→ You may ask ONE useful question if needed

--------------------------------------------------

FINAL CHECK BEFORE ANSWERING

- Is this based on knowledge?
- Did I avoid making things up?
- Is this relevant to the user’s question?
- Is this complete and not cut off?

If not → fix before responding.
`.trim();
}


// ===================== HYBRID EXECUTION ===================== //

function isGoodResponse(text: unknown): text is string {
  if (typeof text !== "string") return false;

  const clean = text.trim();

  if (clean.length < 60) return false;
  if (clean.split(" ").length < 10) return false;

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

  if (!/[.?!]$/.test(fixed)) {
    fixed += ".";
  }

  return fixed.replace(/\s+/g, " ").trim();
}

// ===================== MAIN EXECUTION ===================== //

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

    /* ================= SMART GREETING ================= */
    if (
      /^(hi|hello|hey|yo)\b/.test(msg) &&
      (!historyText || historyText.length < 10)
    ) {
      const reply = "Hey — what do you want to improve right now?";

      await memoryService.addMessage(sessionId, "assistant", reply);
      return reply;
    }

    /* ================= CONTEXT RESET ================= */
    if (shouldResetContext(message || "")) {
      brainContext = {
        ...brainContext,
        detectedServices: [],
        stage: "discovery",
        hasSufficientContext: false,
      };
    }

    /* ================= SERVICE DETECTION ================= */
    try {
      const detectedServices = await detectService(message);

      brainContext.detectedServices = Array.isArray(detectedServices)
        ? detectedServices.filter((s: any) => typeof s === "string")
        : [];
    } catch {
      brainContext.detectedServices = [];
    }

    /* ================= VECTOR ================= */
    let fusedChunksText = "";

    try {
      const chunks = await getFusedChunks(message, 4);

      fusedChunksText = (chunks || [])
        .map((c: any) => c?.text)
        .filter(Boolean)
        .join("\n\n");
    } catch {
      fusedChunksText = "";
    }

    /* ================= PROMPT ================= */
    const prompt = buildHybridPrompt({
      brainContext,
      leadScoreValue,
      detectedIntentNames,
      vectorText: fusedChunksText,
      historyText,
      message,
    });

    let response: string | null = null;

    /* ================= PRIMARY MODEL ================= */
    try {
      const result = await withTimeout(
        generateOpenRouter(prompt, sessionId),
        9000
      );

      if (isGoodResponse(result)) {
        response = result;
      }
    } catch {}

    /* ================= GEMINI FALLBACK ================= */
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

    /* ================= FINAL FALLBACK ================= */
    if (!response) {
      response = fusedChunksText
        ? fusedChunksText.split("\n\n")[0]
        : "I couldn’t find enough relevant data to give a precise answer. Can you clarify your goal a bit more?";
    }


// ================= CLEANING =================
response = cleanHybridResponse(response);
response = repairResponse(response);


// ================= PHASE 2 INTELLIGENCE LAYER =================
try {
  const optimizer = await loadOptimizer();

  if (optimizer) {
    const result = optimizer(response || "");

    if (
      result &&
      typeof result === "object" &&
      typeof result.optimized === "string"
    ) {
      response = result.optimized;
    }
  }
} catch (err) {
  // silent fail (production safe)
}

// ================= SAFETY =================
if (forceNoQuestions && typeof response === "string") {
  response = response.replace(/\?/g, ".");
}

// ================= BOT ENFORCEMENT =================
response = enforceBotName(response || "");


    /* ================= CTA CONTROL ================= */
    if (
      shouldIncludeCTA(
        message,
        intentCategories,
        leadScoreValue,
        brainContext?.stage
      ) &&
      !/execution plan/i.test(response || "")
    ) {
      response +=
        "\n\nIf you want, I can map this into a precise plan for your business.";
    }

    /* ================= SAVE ================= */
    await memoryService.addMessage(sessionId, "assistant", response || "");

    return response;
  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);

    return "Something went wrong. Try rephrasing your question.";
  }
}
