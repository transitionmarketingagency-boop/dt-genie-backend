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

USER MESSAGE (HIGHEST PRIORITY)

${priorityInstruction || ""}

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

  // 🔥 prevent garbage repetition / loops
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

if (!/[.?!]$/.test(fixed)) {
  fixed += ".";
}

// 🔥 force completion feel
if (fixed.length < 120) {
  fixed += " This is the core idea — execution is what drives results.";
}

  return fixed.replace(/\s+/g, " ").trim();
}

function sanitizeFinalOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // remove dataset / vector leaks
  if (
    cleaned.includes('"intent"') ||
    cleaned.includes('"examples"') ||
    cleaned.includes('"response"') ||
    cleaned.includes("FAQ [") ||
    cleaned.includes("Source:")
  ) {
    return "Let me give you a clear answer based on your situation.\n\nCan you clarify your main goal right now?";
  }

  // remove fake system outputs
  cleaned = cleaned.replace(/system is now operational.*$/i, "");

  // remove tool mentions again (double safety)
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


// ================= ENTRY INTELLIGENCE (FINAL STABLE FIX) =================

const isFirstMessage = !historyText || historyText.length < 10;
const isGreeting = /^(hi|hello|hey|yo)\b/.test(msg);

const isHighIntent =
  leadScoreValue >= 0.6 ||
  /(book|hire|call|schedule|appointment)/i.test(msg);

/**
 * FINAL ENTRY MODE (IMMUTABLE)
 * We keep it SIMPLE to avoid TS narrowing bugs
 */
const entryMode =
  isFirstMessage && isGreeting
    ? "onboarding"
    : isHighIntent
    ? "execution"
    : "continuation";

// SAFE alias (no re-declaration risk, no TS narrowing issues)
const finalEntryMode = entryMode;


/* ================= HIGH INTENT OVERRIDE ================= */

if (isHighIntent && !detectBookingRejection(message)) {
  const closeResponse =
    "Got it — you're ready to move forward. The fastest way is to get on a quick call so we can fix this properly based on your setup. I’ll walk you through exactly what we’d change and how we’d improve results.";

  await memoryService.addMessage(sessionId, "assistant", closeResponse);
  return closeResponse;
}

/* ================= SMART ONBOARDING SHORTCUT ================= */

if (isFirstMessage && isGreeting) {
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

    const hasServiceContext =
      Array.isArray(brainContext.detectedServices) &&
      brainContext.detectedServices.length > 0;

// ================= VECTOR (SMART RETRIEVAL FIX) =================

let fusedChunksText = "";

const shouldUseRetrieval =
  message.length > 20 &&
  !/^(hi|hello|hey|yo)\b/i.test(message) &&
  !/(who are you|what do you do)/i.test(message);

if (shouldUseRetrieval) {
  try {
    const chunks = await getFusedChunks(message, 3); // 🔥 reduced from 4 → 3

    fusedChunksText = (chunks || [])
      .map((c: any) => c?.text)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1200); // 🔥 HARD LIMIT to prevent overload
  } catch {
    fusedChunksText = "";
  }
}

    // ================= CONTINUITY SIGNAL =================

// ================= CONTEXT CONTROL (ANTI-BLEED FIX) =================

const isNewTopic =
  shouldResetContext(message) ||
  message.length > 40 && !message.toLowerCase().includes("that");

const safeHistoryText =
  isNewTopic || isGreeting
    ? "" // 🔥 HARD RESET
    : (historyText || "").slice(-800); // 🔥 LIMIT HISTORY

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

// 🔥 HARD PRIORITY SIGNAL
// Ensures model NEVER answers previous question
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

      if (isGoodResponse(result)) {
        response = result;
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
response =
  isGreeting
    ? "Tell me what you're trying to improve in your business right now."
    : message.length < 10
    ? "Give me a bit more detail about your situation so I can give you a precise answer."
    : `Based on your situation: ${message.slice(0, 80)} — here’s what matters most.`;
    }

    // ================= CLEANING =================

    response = cleanHybridResponse(response);
    response = repairResponse(response);

    // ================= PHASE 2 OPTIMIZER =================

    try {
      const optimizer = await loadOptimizer();

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

// ================= DUPLICATE RESPONSE PROTECTION =================

try {
  const lastMessages = await memoryService.getRecentMessages(sessionId, 2);

  const lastBotMessage = lastMessages?.find((m: any) => m.role === "assistant")?.content;

if (lastBotMessage && typeof response === "string") {
  const similarity =
    response.slice(0, 120) === lastBotMessage.slice(0, 120);

  if (similarity) {
    response =
      "Let me answer that more directly based on your situation.\n\n" +
      response +
      "\n\nThe key issue here is usually conversion or targeting mismatch — fixing that is where results come from.";
  }
}

} catch {}

/* ================= CTA ENGINE (PHASE 5.5) ================= */

const cta = generateCTA({
  message,
  stage: brainContext?.stage,
  leadScore: leadScoreValue,
  detectedServices: brainContext?.detectedServices,
  executionMode: brainContext?.executionMode,
});

// ================= CTA CONTROL (ANTI-SPAM FIX) =================

const shouldAddCTA =
  cta &&
  typeof response === "string" &&
  !detectBookingRejection(message) &&
  !isGreeting &&
  leadScoreValue >= 0.6 && // 🔥 stricter
  !/^(hi|hello|hey)\b/i.test(message) &&
  !response.toLowerCase().includes("clarify your goal");

if (shouldAddCTA) {
  response += "\n\n" + cta;
}

    // ================= SAVE =================

    await memoryService.addMessage(sessionId, "assistant", response || "");

    return response;
  } catch (err) {
    console.error("[Hybrid Fatal Error]:", err);
    return "Something went wrong. Try rephrasing your question.";
  }
}
