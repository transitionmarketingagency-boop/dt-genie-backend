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
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")

    // ❌ remove links
    .replace(/https?:\/\/\S+/gi, "")

    // ❌ remove tool/platform mentions
    .replace(
      /\b(semrush|ahrefs|zapier|openai|chatgpt|gemini|activepieces|salesforce|hubspot|klaviyo|shopify\s?apps?|jasper|perplexity|sprout\s?social|spark\s?toro|sparktoro|firecrawl|ad\s?creative(\.ai)?|synthesia|apollo|instantly|mailchimp|sendgrid|brevo|runway|pika|leonardo|elevenlabs|descript|riverside)\b/gi,
      "AI systems"
    )

    // ❌ remove "Tool: xyz"
    .replace(/tool:\s*[a-z0-9.\-]+/gi, "")

    // ❌ remove "Platform: xyz"
    .replace(/platform:\s*[a-z0-9.\-]+/gi, "")

    .trim();
}


function removePricing(text: string): string {
  if (!text) return "";

  return text
    // remove currency symbols + full numbers correctly
    .replace(/[$€£]\s?\d{1,3}(?:,\d{3})*(\.\d+)?/gi, "")
    .replace(/\b\d{1,3}(?:,\d{3})*(\.\d+)?\s?(usd|eur|gbp)\b/gi, "")

    // remove standalone broken numeric fragments like ",250" or ",850"
    .replace(/\b,\d{2,4}\b/g, "")

    // remove standalone K formats safely
    .replace(/\b\d+(k|K)\b/g, "")

    // remove pricing words only when attached to numbers
    .replace(
      /\b(starting from|starts at|from|as low as|minimum budget|priced at)\b\s*\$?\d*.*?(per month|monthly|yearly|per year|per week|weekly)?/gi,
      ""
    )

    // cleanup spacing
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}


function removeIdentitySpam(text: string): string {
  if (!text) return "";

  return text.replace(
    /hello!? i('|’)m neon vision[^.]*\./gi,
    ""
  ).trim();
}


function enforceBookingOnly(text: string): string {
  if (!text) return "";

  // remove fake confirmations
  let cleaned = text
    .replace(/calendar invite[^.]*\./gi, "")
    .replace(/check your inbox[^.]*\./gi, "")
    .replace(/i('|’)ve (booked|scheduled)[^.]*\./gi, "");

  // remove contact phrases
  cleaned = cleaned.replace(
    /(email|phone|contact us|reach out)[^.]*\./gi,
    ""
  );

  return cleaned.trim();
}


function detectPricingIntent(message: string): boolean {
  if (!message) return false;

  const msg = message.toLowerCase();

  return (
    /\b(price|pricing|cost|costs|budget|quote|rate|rates|charge|charges|fee|fees|cheapest|premium|plan|tier)\b/.test(
      msg
    ) ||
    /\bwhat\s+do\s+you\s+charge\b/.test(msg) ||
    /\bhow\s+much\b/.test(msg)
  );
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
You are Neon Vision, the AI system of Digital Transition Marketing.

- Neon Vision = the AI
- Digital Transition Marketing = the company

Never confuse the two.
Never say your name is the company.

Your role is to provide accurate, grounded, and business-relevant answers.

--------------------------------------------------

CRITICAL RULES (STRICT)

1. ONLY use the provided KNOWLEDGE when available
2. DO NOT make up services, tools, data, or claims
3. NEVER mention specific tools, platforms, or software names
   → Always describe them as systems, infrastructure, or technology layers
4. DO NOT give contact details, emails, or external links
5. DO NOT invent statistics, case studies, or numbers
6. DO NOT mention pricing, costs, budgets, or monetary values under any circumstances
7. If user asks about pricing:
   → Do NOT answer with numbers
   → Politely guide them to a discovery call or website
8. DO NOT act like a “guru” or “strategist personality”
9. DO NOT ask repetitive or unnecessary questions

If knowledge is missing:
→ Answer naturally using general business reasoning
→ Do NOT mention missing data
→ Do NOT mention knowledge availability
→ Do NOT apologize or explain limitations

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

RESPONSE STYLE (VERY IMPORTANT)

- Speak like a real human strategist, not a template
- DO NOT follow rigid formats or numbered structures unless necessary
- Avoid robotic phrasing like:
  "1. Direct answer 2. Explanation 3. Next step"

Instead:
→ Answer naturally
→ Be clear and direct
→ Add explanation only if it adds value
→ Suggest next steps only when it makes sense

EXECUTION MODE:

If executionMode = "execution":
→ Be decisive and action-focused
→ Give clear recommendations
→ Do NOT ask questions unless absolutely necessary

If executionMode = "exploration":
→ You may ask ONE smart, relevant question if it helps clarify
→ Do NOT ask generic questions

--------------------------------------------------

FINAL CHECK BEFORE ANSWERING

- Is this based on knowledge?
- Did I avoid making things up?
- Is this relevant to the user’s question?
- Is this complete and not cut off?

If not → fix before responding.
`.trim();
}

// ===================== HYBRID EXECUTION =====================
function isGoodResponse(text: unknown): text is string {
  if (typeof text !== "string") return false;

  const clean = text.trim();
  if (!clean) return false;

  const lower = clean.toLowerCase();

  // ✅ VERY LIGHT FILTER (DO NOT BLOCK GOOD RESPONSES)
  if (clean.length < 12) return false;

  const badPatterns = [
    "undefined",
    "error occurred",
    "intent:",
    "examples:",
    "response:",
    "{",
    "}",
    "@",
    "http"
  ];

  if (badPatterns.some(p => lower.includes(p))) return false;

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

  // Normalize spacing
  fixed = fixed.replace(/\s+/g, " ").trim();

  // Ensure sentence completion ONLY if needed
  if (!/[.?!]$/.test(fixed)) {
    fixed += ".";
  }

  // ❌ FIX: only add filler if response is TOO short AND not CTA
  const isCTA = /(call|book|schedule|get started)/i.test(fixed);

  if (fixed.length < 70 && !isCTA) {
    fixed += " Let me know if you want me to go deeper on this.";
  }

  return fixed;
}


function sanitizeFinalOutput(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 🔒 Remove dataset / vector leaks
  if (
    cleaned.includes('"intent"') ||
    cleaned.includes('"examples"') ||
    cleaned.includes('"response"') ||
    cleaned.includes("FAQ [") ||
    cleaned.includes("Source:")
  ) {
    return "Let me give you a clear answer based on your situation.";
  }

  // 🔒 Remove system artifacts
  cleaned = cleaned.replace(/system is now operational.*$/i, "");

  // 🔒 HARD REMOVE ALL TOOL / PLATFORM NAMES (SAFE SINGLE-LINE REGEX)
  cleaned = cleaned.replace(
    /\b(spark\s?toro|sparktoro|firecrawl|ad\s?creative(\.ai)?|jasper|zapier|hubspot|klaviyo|synthesia|instantly|apollo|tiktok|instagram|meta\s?ads\s?manager|chatgpt|openai|gemini|salesforce|shopify\s?apps?)\b/gi,
    ""
  );

  // 🔒 Cleanup spacing
// 🔒 OWNERSHIP ENFORCEMENT (CRITICAL FIX)
if (/digital transition marketing/i.test(cleaned)) {
  cleaned = cleaned
    .replace(/\bthey\b/gi, "we")
    .replace(/\btheir\b/gi, "our")
    .replace(/\bthem\b/gi, "us")
    .replace(/\bthe company\b/gi, "we")
    .replace(/\bthis company\b/gi, "we")
    .replace(/\bthat company\b/gi, "we")
    .replace(/\bthe agency\b/gi, "we");
}

// 🔒 Fix specific high-risk phrases
cleaned = cleaned
  .replace(/\btheir website\b/gi, "our website")
  .replace(/\bvisit their website\b/gi, "visit our website")
  .replace(/\bcheck their website\b/gi, "check our website")
  .replace(/\bthey offer\b/gi, "we offer")
  .replace(/\bthey provide\b/gi, "we provide")
  .replace(/\bthey can\b/gi, "we can");

// 🔒 Cleanup spacing
cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

return cleaned;

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
const isGreeting = /^(hi|hello|hey|yo)$/i.test(msg.trim());

// ✅ FIXED (removed broken trailing &&)
const isHighIntent = leadScoreValue >= 0.7;

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
  message.length > 8 &&
  !/^(hi|hello|hey|yo)\b/i.test(message);

if (shouldUseRetrieval) {
  try {
    const result: unknown = await Promise.race([
      getFusedChunks(message, 3),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("vector-timeout")), 2500)
      ),
    ]);

    // ✅ HARD TYPE SAFETY (fixes TS + runtime)
    const safeChunks = Array.isArray(result) ? result : [];

    fusedChunksText = safeChunks
      .map((c: any) => c?.text)
      .filter((t: any) => typeof t === "string" && t.trim().length > 0)
      .join("\n\n")
      .slice(0, 1200);

  } catch (err: any) {
    // ✅ DO NOT BLOCK RESPONSE
    fusedChunksText = "";

    // ✅ OPTIONAL DEBUG (SAFE - won't break prod)
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Vector Retrieval Failed]:", err?.message);
    }
  }
}

// ================= CONTEXT CONTROL (ANTI-BLEED FIX) =================

const isNewTopic =
  shouldResetContext(message) ||
  (message.length > 40 && !message.toLowerCase().includes("that"));

const safeHistoryText =
  isNewTopic || isGreeting
    ? ""
    : (historyText || "").slice(-800);


// ================= PROMPT =================

brainContext.executionMode = finalEntryMode;

const prompt = buildHybridPrompt({
  brainContext: {
    ...brainContext,
    executionMode: finalEntryMode, // ✅ FIXED
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
  14000 // 🔥 prevents cut responses
);

  if (isGoodResponse(result)) {
    response = result;
  }
} catch {}


// ================= GEMINI FALLBACK (STRICT - HARD FAILURE ONLY) =================

const isHardFailure =
  !response ||
  typeof response !== "string" ||
  response.trim().length < 10;

if (isHardFailure && GEMINI_ENABLED && canUseGemini()) {
  try {

const result = await withTimeout(
  generateGemini(prompt, sessionId),
  5000
);

    if (isGoodResponse(result)) {
      response = result;
      markGeminiUsed?.();
    }
  } catch {}
}



// ================= FINAL FALLBACK (HARD FAIL ONLY - NO LOOPS) =================

const isHardFail =
  !response ||
  typeof response !== "string" ||
  response.trim().length < 20;

if (isHardFail) {
  const msg = (message || "").toLowerCase();

  const isBookingIntent =
    /(book|call|schedule|appointment|hire|get started|work with you)/i.test(msg);

  const isVeryShortGreeting =
    /^(hi|hello|hey|yo)$/i.test(msg.trim());

  if (isVeryShortGreeting) {
    response =
      "Hey — what are you trying to improve in your business right now?";
  }

  else if (isBookingIntent) {
    response =
      "Got it — I can help you with that. Let’s take this into a quick call setup.";
  }

  else {
    // ✅ ONLY ONE fallback (no rotation, no loops)
    response =
      "I need a bit more clarity to guide you properly. What exactly are you trying to improve?";
  }
}

// ================= PRICING GUARD (STABLE HUMANIZED FIX) =================

const pricingIntent = detectPricingIntent(message);

if (pricingIntent) {
  const services = brainContext?.detectedServices || [];
  const stage = brainContext?.stage || "discovery";

  let contextHint = "";

  if (services.length > 0) {
    contextHint = `For something like ${services.slice(0, 2).join(" and ")}, `;
  } else if (stage === "execution") {
    contextHint = "At an execution level, ";
  } else if (stage === "strategy") {
    contextHint = "At a strategic level, ";
  }

  const openers = [
    `${contextHint}it depends on the scope and how advanced the system needs to be.`,
    `${contextHint}pricing varies based on what you're trying to achieve and build.`,
    `${contextHint}there isn’t a fixed number because every setup is different.`,
    `${contextHint}it changes based on the depth of implementation required.`,
  ];

  const closers = [
    "Once I understand your setup, I can give you a precise breakdown.",
    "If you share your goals, I can map the right structure for you.",
    "We can define everything clearly after reviewing your current situation.",
    "I can give you a much more accurate direction once I understand your needs.",
  ];

  const opener = openers[Math.floor(Math.random() * openers.length)];
  const closer = closers[Math.floor(Math.random() * closers.length)];

  const generatedResponse = `${opener} ${closer}`;

  // ✅ ONLY override if model response is weak or missing
  const isBadModelResponse =
    !response ||
    response.length < 50 ||
    /one-size-fits-all|it depends|pricing depends|not fixed/i.test(
      response.toLowerCase()
    );

  // ✅ SAFE override only when needed
  if (isBadModelResponse) {
    response = generatedResponse;
  }
}


// ================= CLEANING =================

response = cleanHybridResponse(response || "");

// 1. Remove system + tool leakage
response = removeForbiddenContent(response);

// 2. Remove pricing / monetary leaks
response = removePricing(response);


// 3. Final grammar + flow fix
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

// ✅ NEW FIX: remove fake booking + contact behavior
response = enforceBookingOnly(response);

// ✅ REMOVE IDENTITY SPAM
response = removeIdentitySpam(response);

// 🔥 FINAL OWNERSHIP FAILSAFE (LAST LINE OF DEFENSE)
if (typeof response === "string") {
  response = response
    .replace(/\bthey\b/gi, "we")
    .replace(/\btheir\b/gi, "our")
    .replace(/\bthem\b/gi, "us");
}

// ================= DUPLICATE RESPONSE PROTECTION =================

try {
  const lastMessages = await memoryService.getRecentMessages(sessionId, 2);

  const lastBotMessage = lastMessages?.find((m: any) => m.role === "assistant")?.content;

  if (lastBotMessage && typeof response === "string") {
const similarity =
  response.slice(0, 80) === lastBotMessage.slice(0, 80);

const isPricingIntentMsg =
  /(price|pricing|cost|budget|how much|fees|plans?|tiers?)/i.test(message);

if (similarity && !isPricingIntentMsg) {
  response =
    response +
    "\n\nLet me approach this from a slightly different angle.";
}

  }
} catch {}



/* ================= CTA ENGINE ================= */

const cta = generateCTA({
  message,
  stage: brainContext?.stage,
  leadScore: leadScoreValue,
  detectedServices: brainContext?.detectedServices,
});

/* ================= CTA CONTROL (FINAL STABLE FIX) ================= */

const normalizedMsg = (message || "").toLowerCase();

/**
 * Detect booking intent (CRITICAL FIX)
 * Prevents CTA from conflicting with booking UI trigger
 */
const isBookingIntent =
  /(book|call|schedule|appointment|hire|get started)/i.test(
    normalizedMsg
  );

/**
 * Safe response normalization
 */
let safeResponse =
  typeof response === "string" ? response : String(response || "");

/**
 * Prevent CTA on weak or incomplete responses
 */
const isIncompleteResponse =
  !safeResponse || safeResponse.trim().length < 60;

/**
 * Prevent duplicate CTA injection
 */
const alreadyHasCTA =
  typeof cta === "string" &&
  cta.trim().length > 0 &&
  safeResponse.includes(cta.trim());

/**
 * FINAL CTA GUARD (STRICT + CONFLICT-SAFE)
 */
const shouldAddCTA =
  typeof cta === "string" &&
  cta.trim().length > 0 &&
  !detectBookingRejection(message) &&
  !isGreeting &&
  !isBookingIntent &&        // 🔥 CRITICAL FIX
  !isIncompleteResponse &&
  !alreadyHasCTA &&
  safeResponse.length > 60 &&
  leadScoreValue >= 0.75 &&
  String(brainContext?.executionMode) === "execution";

/* ================= APPLY CTA ================= */

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
