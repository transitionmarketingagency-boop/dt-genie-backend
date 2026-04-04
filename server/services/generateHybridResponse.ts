// server/services/generateHybridResponse.ts
import { getFusedChunks } from "../services/intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { detectIntent, Intent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";
import { strategicBrain } from "./strategicBrain.js";
import bookingFlow from "../bookingFlow.js";
import { analyzeLeadSignals } from "./leadIntelligence.js";
import { shouldTriggerBooking } from "./bookingTrigger.js";

/* ================= SAFETY HELPERS ================= */

function detectBookingRejection(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("not now") ||
    msg.includes("don't want") ||
    msg.includes("dont want") ||
    msg.includes("later") ||
    msg.includes("no thanks") ||
    msg.includes("stop")
  );
}

function smartFallback(message: string, context: string = ""): string {
  const msg = message.toLowerCase();

  // Context-aware dynamic fallback
  if (msg.includes("traffic") && msg.includes("sales")) {
    return "You're likely dealing with a conversion gap, not a traffic problem. This usually comes down to messaging, offer clarity, or funnel friction. The fastest way to fix this is identifying where users drop off and optimizing that step.";
  }

  if (msg.includes("roas") || msg.includes("ads")) {
    return "Dropping ROAS during scaling usually signals creative fatigue, audience saturation, or inefficient budget distribution. The fix is not scaling harder, but scaling smarter with better creative and targeting resets.";
  }

  if (msg.length < 10) {
    return "Tell me a bit more about what you're trying to achieve, and I’ll map out a clear direction for you.";
  }

// Dynamic fallback (clean, non-repetitive, complete)
return `Let’s break this down properly.

Based on what you’re asking, the issue likely sits in one of these areas:
- Traffic quality vs intent mismatch
- Weak conversion structure (landing page or funnel)
- Messaging not aligned with buyer stage

The fastest way forward is identifying exactly where users drop off and fixing that specific step.

If you want, tell me a bit about your current setup and I’ll map out the exact fix for you.`;
}


function shouldIncludeCTA(
  message: string,
  intentCategories: string[] = [],
  leadScore: number = 0,
  stage: string = "discovery"
): boolean {
  const lower = message.toLowerCase();

  const explicitIntent =
    lower.includes("call") ||
    lower.includes("schedule") ||
    lower.includes("consultation");

const highIntent =
  leadScore >= 7 ||
  stage === "service" ||
  stage === "conversion";

  if (intentCategories.includes("general")) return false;

  return explicitIntent || highIntent;
}

/* ================= GEMINI CONFIG ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = { count: 0, lastReset: Date.now() };

function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 86400000;
  if (now - geminiUsage.lastReset > ONE_DAY) {
    geminiUsage.count = 0;
    geminiUsage.lastReset = now;
  }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}

function markGeminiUsed() {
  geminiUsage.count++;
}

/* ================= TIMEOUT ================= */

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

/* ================= RESPONSE HELPERS ================= */

const MAX_CONTEXT_CHARS = 1200;

function compressContext(chunks: any[], maxLength: number = 300): string {
  if (!chunks?.length) return "";
  const seen = new Set<string>();
  return chunks
    .map((c, i) => {
      const txt = c?.text?.replace(/\s+/g, " ").trim().slice(0, maxLength);
      if (!txt || seen.has(txt)) return "";
      seen.add(txt);
      return `[Knowledge ${i + 1}] ${txt}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARS);
}

function looksIncomplete(text: string): boolean {
  if (!text) return true;

  const trimmed = text.trim();

  // Accept shorter responses; only reject clearly too short


// Reject very short responses
if (trimmed.length < 20) return true;

// Must end cleanly
// allow conversational endings for shorter responses
if (!/[.!?]$/.test(trimmed) && trimmed.length < 80) return true;

// Detect cut-off patterns
if (/[,$:]$/.test(trimmed)) return true;

// Detect broken currency / sentences
if (/\$\s*$/.test(trimmed)) return true;

// Detect non-latin corruption (Chinese, etc.)
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) return true;

// Reject only clearly broken responses
if (
  trimmed.includes("I'm having trouble") ||
  trimmed.toLowerCase().includes("couldn't generate") ||
  trimmed.toLowerCase().includes("something went wrong")
) {
  return true;
}

// Reject garbage only
if (!/[a-zA-Z]/.test(trimmed)) return true;

// Detect extreme repetition only
if (/(.{20,})\1{2,}/i.test(trimmed)) return true;

return false;
}

function sanitizeTools(text: string): string {
  const toolMap: Record<string, string> = {
    Creatify: "advanced AI content systems",
    Wisepops: "AI marketing automation tools",
    "AdCreative.ai": "AI ad optimization systems",
    "AIclicks.io": "AI performance tracking tools",
    OpenAI: "proprietary AI systems",
    Midjourney: "proprietary AI systems",
  };
  for (const [tool, replacement] of Object.entries(toolMap)) {
    text = text.replace(new RegExp(`\\b${tool}\\b`, "gi"), replacement);
  }
  return text;
}

function removeContactInfo(text: string): string {
  if (!text) return "";
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "");
  text = text.replace(/\+?\d[\d\s-]{7,}\d/g, "");
  text = text.replace(/\d{1,5}\s\w+(\s\w+){0,5},?\s\w{2,20}/gi, "");
  text = text.replace(/(contact us at|reach us at|email us at|call us at)[^.]*\./gi, "");
  return text;
}

function cleanHybridResponse(text: string): string {
  if (!text) return "";

  // basic sanitization
  text = sanitizeTools(text);
  text = removeContactInfo(text);


  // normalize spacing
  text = text.replace(/\s+/g, " ");

  return text.trim();
}


function isLowQuality(text: string): boolean {
  if (!text) return true;
  if (text.length < 25) return true;
if (text.split(" ").length < 8) return true;
  if (text.includes("I'm having trouble")) return true;
  if (/^[^a-zA-Z0-9]+$/.test(text)) return true;
  return false;
}

function compressResponse(text: string): string {
  if (text.length < 1200) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;

const selected = sentences.slice(0, 6).join(" ").trim();

// Ensure last sentence is complete
if (!/[.!?]$/.test(selected)) {
  return selected + ".";
}

return selected;
}

/* ================= QUERY EXPANSION ================= */

async function expandQueryNeural(userMessage: string, history: string[] = []) {
  const normalized = userMessage.trim().toLowerCase();
  const expansions = [normalized];
  const words = normalized.split(" ").slice(0, 5);

  if (words.length > 1) {
    expansions.push(`${words.join(" ")} marketing`);
    expansions.push(`${words.join(" ")} service`);
    expansions.push(`${words.join(" ")} strategy`);
    expansions.push(`${words.join(" ")} implementation`);
  }

  history.slice(-2).forEach((h) => expansions.push(h.toLowerCase()));
  return Array.from(new Set(expansions));
}

/* ================= NEURAL BRAIN ================= */

function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  // Greeting regex (only trigger for short, standalone greetings)
  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  // Booking / scheduling intent
  if (
    msg.includes("book") ||
    msg.includes("schedule") ||
    msg.includes("meeting") ||
    msg.includes("appointment") ||
    msg.includes("call")
  ) {
    return { type: "booking" };
  }

  // Identity query
  if (msg.includes("who are you")) {
    return { type: "identity" };
  }

  // Greeting (only if message is very short)
if (greetingRegex.test(msg) && msg.split(" ").length <= 3) {
    return { type: "greeting" };
  }

  // Default
  return { type: "normal" };
}

/* ================= MAIN HYBRID RESPONSE ================= */

export async function generateHybridResponse({
  message,
  sessionId,
  history = [],
}: {
  message: string;
  sessionId: string;
  history?: any[];
}): Promise<string> {
  try {

    // 🔥 CACHE RECENT MESSAGES (PREVENT MULTIPLE DB CALLS)
    const recentMessagesCache =
      history.length > 0
        ? history
        : await memoryService.getRecentContext(sessionId).catch(() => []);

    /* ---------- STRATEGIC BRAIN ---------- */
const [brainData] = await Promise.all([
  strategicBrain(message, sessionId),
  analyzeLeadSignals(message, sessionId) // fire in parallel
]);

const { brainContext, chunks: strategicChunks = [] } = brainData;

    /* ---------- BOOKING FLOW ---------- */
    if (bookingFlow.isBookingActive(sessionId)) {
      if (detectBookingRejection(message)) {
        bookingFlow.reset(sessionId);
        return "No problem — we can continue here. What would you like to explore?";
      }
      const bookingResp = await bookingFlow.handleStep(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

/* ---------- SMART BOOKING TRIGGER (FIXED) ---------- */

const autoBooking =
  (await shouldTriggerBooking(sessionId, brainContext.stage)) &&
  brainContext.leadScore >= 6;

if (
  autoBooking &&
  !bookingFlow.isBookingActive(sessionId) &&
  !detectBookingRejection(message)
) {
  const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);

  await memoryService.saveMessage(
    sessionId,
    "assistant",
    bookingResp.response
  );

  return bookingResp.response;
}

    /* ---------- NEURAL BRAIN ---------- */
    const brain = neuralBrain(message);
    if (brain.type === "identity") return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing.`;
    if (brain.type === "booking") {
      const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

if (brain.type === "greeting") {
  if (brainContext?.dynamicGreeting) {
    return brainContext.dynamicGreeting;
  }

  return "Hi — what are you looking to improve or grow right now?";
}


/* ---------- HIGH-INTENT OVERRIDE (SMART CONVERSION) ---------- */
const lowerMsg = message.toLowerCase();

if (
  lowerMsg.includes("work with you") ||
  lowerMsg.includes("hire you") ||
  lowerMsg.includes("get started") ||
  lowerMsg.includes("start working") ||
  lowerMsg.includes("how do we start")
) {
  return "Great — the best next step is a quick strategy call so we can map this properly. I’ll guide you through the process.";
}

/* ---------- HISTORY ---------- */
// Use cached messages to avoid multiple DB calls
const historyMessages: any[] = recentMessagesCache || [];

const historyText = historyMessages
  .slice(-2) // only take last 2 messages for context
  .map((h: any) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content || ""}`)
  .join("\n");

    /* ---------- INTENT & SERVICE ---------- */
    let intentMatches: { intent: Intent; score?: number }[] = [];
    try { const detected = detectIntent(message); if (Array.isArray(detected)) intentMatches = detected; } catch {}
    const detectedIntentNames = intentMatches.length > 0 ? intentMatches.slice(0, 3).map((i) => i.intent.name) : ["general"];
    const intentCategories = intentMatches.map((i) => i.intent.category);

let detectedService: string | null = null;
    try { detectedService = detectService(message); } catch {}

/* ---------- VECTOR KNOWLEDGE ---------- */

// Run query expansion and vector fetch in parallel (faster)
const expandedQueriesPromise = expandQueryNeural(
  message,
  historyMessages.map((h) => h.content)
);

const fusedChunksPromise = expandedQueriesPromise.then((queries) =>
  getFusedChunks(queries.join(" "), 4)
);

// Wait for both
const [expandedQueries, fusedChunks] = await Promise.all([
  expandedQueriesPromise,
  fusedChunksPromise
]);

// Merge + dedupe
const mergedChunks = [
  ...strategicChunks,
  ...(fusedChunks || [])
].filter(
  (c, i, arr) =>
    c?.text &&
    arr.findIndex((x) => x.text === c.text) === i
);

// Limit chunks for speed (IMPORTANT)
const limitedChunks = mergedChunks.slice(0, 5);

// Compress context
const vectorText = compressContext(limitedChunks, 220);

// Debug count (keep original meaning)
const vectorCount = limitedChunks.length;

    /* ---------- PROMPT ---------- */

const avoidQuestions =
  brainContext.hasSufficientContext &&
  brainContext.stage !== "discovery";


const knownContext = `
Known User Context:
${historyText}

Industry: ${brainContext.strategicMemory?.industry || "unknown"}
Business Type: ${brainContext.strategicMemory?.businessType || "unknown"}

IMPORTANT:
- Do NOT ask for information already provided above
- Use this context to move the conversation forward
`;

const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

ROLE:
You help businesses grow using AI-powered marketing systems, focusing on results, strategy, and conversion.

CRITICAL RULES:
- Only use provided context (no guessing pricing or services)
- If pricing is missing → explain value instead
- Be natural, human, and strategic (not robotic)
- Avoid repetition and generic answers
- ALWAYS finish sentences completely
- NEVER cut off mid-thought
- NEVER output partial or corrupted text
- Focus on solving the user's business problem
- DO NOT over-focus on one service (like GEO)
- Dynamically choose from ALL services:
  (SEO, GEO, Performance Marketing, CGI Ads, Automation, Analytics, Content, Branding, Web Development, AI Virtual 3D Property Tours, Voice Search Optimization, Music Production, Video & Audio Production, AI Driven Email Marketing, YouTube Ads, Social Media & Influencer Marketing)
- Recommend combinations, not single solutions

🔥 BEHAVIOR FIXES (CRITICAL):

- DO NOT ask unnecessary questions
- If user already gave business context → DO NOT ask setup questions again
- If context exists → give solution directly
${avoidQuestions ? "- DO NOT ask ANY questions in this response" : ""}
- Only ask a question if it directly improves the solution
- Prefer giving solutions FIRST, then ask ONE focused question if needed
- If user already provided context → DO NOT ask for it again
- If user repeats → go deeper instead of repeating yourself
- NEVER loop the same question again

RESPONSE STRUCTURE (MANDATORY):

1. Identify the real problem clearly
2. Give a SPECIFIC actionable solution
3. (Optional) Ask ONE sharp follow-up question

USER ANALYSIS:
- Intent: ${detectedIntentNames.join(",")}
- Service Interest: ${detectedService ?? "multi-service"}
- Funnel Stage: ${brainContext.stage}
- Lead Score: ${brainContext.leadScore}
- Strategy Insight: ${brainContext.reasoning}
- Detected Services: ${brainContext.detectedServices?.join(", ") || "none"}

${knownContext}

KNOWLEDGE:
${vectorText}

USER MESSAGE:
${message}

INSTRUCTIONS:
- Think step-by-step before answering
- Identify the REAL problem behind the user message
- Give SPECIFIC, actionable, non-generic advice
- Adapt response based on funnel stage
- Use reasoning: ${brainContext.reasoning}
- Use detected services intelligently (not repetitively)
- Sound like a human strategist, not a template
- If enough context exists → MOVE FORWARD, don't ask basics again
- Avoid repeating structures or phrases
- Keep response concise but impactful
- Prefer depth over generic brevity
- Avoid surface-level answers
`;

/* ---------- HYBRID MODEL EXECUTION (FAST + RELIABLE) ---------- */

let response = "";
let modelUsed = "none";

// Run both models in parallel (fast timeouts)
const qwenPromise = withTimeout(generateOpenRouter(prompt), 6500);

const geminiPromise = canUseGemini()
  ? withTimeout(generateGemini(prompt), 3200)
  : Promise.resolve(null);

// ⚡ Wait for BOTH (ensures fallback safety + avoids undefined vars)
const qwenResp = await qwenPromise;

let geminiResp: string | null = null;

if (!qwenResp || looksIncomplete(qwenResp)) {
  if (canUseGemini() && message.length > 15) {
    geminiResp = await geminiPromise;
  }
}

// Priority: Qwen -> Gemini (controlled + stable)

// Accept Qwen unless clearly broken
if (qwenResp && !looksIncomplete(qwenResp)) {
  response = qwenResp;
  modelUsed = "Qwen";
}
// Only fallback to Gemini if Qwen failed or is broken
else if (geminiResp && !looksIncomplete(geminiResp)) {
  response = geminiResp;
  modelUsed = "Gemini";
  markGeminiUsed();
}

/* ---------- FINAL FALLBACK (SMART + CONTROLLED) ---------- */

if (!response) {

  const lastMessages = await memoryService.getRecentContext(sessionId);

  const lastAssistant = lastMessages
    ?.slice()
    ?.reverse()
    ?.find((m: any) => m.role === "assistant")?.content || "";

  const fallbackOptions = [
    smartFallback(message),
    "Give me a bit more detail so I can give you something precise.",
    "Let’s narrow this down — what specific result are you aiming for?",
  ];

  // pick one randomly
  let fallback =
    fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];

  // 🚫 prevent repetition of same fallback
  if (lastAssistant && fallback && lastAssistant.slice(0, 80) === fallback.slice(0, 80)) {
    fallback =
      "Tell me a bit more about your situation so I can give you a more targeted answer.";
  }

  response = fallback;
  modelUsed = "fallback";
}



/* ---------- CLEANUP (STABLE + NON-DESTRUCTIVE) ---------- */

response = removeContactInfo(response);

// remove non-latin corruption once
response = response.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, "");

response = response
  // normalize spaces
  .replace(/\s+/g, " ")
  // remove spaces before punctuation
  .replace(/\s([.,!?])/g, "$1")
  // remove common LLM fallback phrases that should never reach user
  .replace(
    /(i'?m having (a )?(temporary )?delay.*|there'?s a slight delay.*|i can still help you strategically.*)/gi,
    ""
  )
  // final trim
  .trim();

/* ---------- SAFE RETRY LOGIC (ONLY IF TRULY BAD) ---------- */

if (
  modelUsed === "Qwen" &&
  (isLowQuality(response) ||
    response.toLowerCase().includes("i'm having trouble") ||
    response.toLowerCase().includes("couldn't generate"))
) {
  console.log("⚠️ Low-quality response detected — retrying with Gemini");

const retry = await withTimeout(generateGemini(prompt), 4000);

  if (retry) {
    let retryClean = cleanResponse(retry);
    retryClean = removeContactInfo(retryClean);

    retryClean = retryClean
      .replace(/\s+/g, " ")
      .replace(/\s([.,!?])/g, "$1")
      .trim();

    // ✅ Only switch if actually better
    if (!isLowQuality(retryClean)) {
      response = retryClean;
      modelUsed = "Gemini";
    }
  }
}

/* ---------- LENGTH CONTROL (SAFE) ---------- */

if (response && response.length > 1200) {
  response = compressResponse(response);
}

/* ---------- FINAL IDENTITY ENFORCEMENT ---------- */

if (response) {
  response = enforceBotName(response);
}

/* ---------- SMART CTA (DYNAMIC + CLEAN) ---------- */

if (
  response &&
  shouldIncludeCTA(
    message,
    intentCategories,
    brainContext.leadScore,
    brainContext.stage
  )
) {
  response = response.replace(/\.*$/, "");

  const ctas = [
    "If you want, I can map this into a step-by-step plan for your business.",
    "I can break this down into an execution plan if you’d like.",
    "Want me to turn this into a clear action plan for you?",
  ];

  response += "\n\n" + ctas[Math.floor(Math.random() * ctas.length)];
}

/* ---------- FINAL SAFETY CHECK (SMART FALLBACK) ---------- */

if (!response || looksIncomplete(response)) {
  console.log("⚠️ Final response failed validation → using fallback");

  const lastMessages = recentMessagesCache;

  const lastAssistant =
    lastMessages
      ?.slice()
      ?.reverse()
      ?.find((m: any) => m.role === "assistant")?.content || "";

  const msg = message.toLowerCase();

  let fallbackOptions: string[] = [
    "Tell me a bit more about your situation so I can give you something specific.",
    "Give me a bit more detail — I’ll refine this properly for you.",
    "What’s the main bottleneck you're facing right now?",
  ];

  // ✅ Context-aware fallback (clean + minimal)
  if (msg.includes("ecommerce") || msg.includes("store")) {
    fallbackOptions = [
      "For e-commerce, growth issues usually come from conversion flow, traffic quality, or product positioning — which one feels off right now?",
    ];
  } else if (msg.includes("ads") || msg.includes("roas")) {
    fallbackOptions = [
      "Low ROAS usually points to creative fatigue or audience mismatch — want me to break that down?",
    ];
  } else if (msg.includes("seo")) {
    fallbackOptions = [
      "SEO issues usually come from structure, content depth, or indexing — what are you currently doing?",
    ];
  }

  let selected =
    fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];

  // 🚫 Prevent repetition (safe check)
  if (
    lastAssistant &&
    selected &&
    lastAssistant.slice(0, 80) === selected.slice(0, 80)
  ) {
    selected =
      "Let’s go deeper — what’s the biggest issue you're trying to solve right now?";
  }

  response = selected;
  modelUsed = "fallback";
}

/* ---------- PREVENT REPETITION ---------- */

const lastMessages = recentMessagesCache;

const lastAssistant =
  lastMessages
    ?.slice()
    ?.reverse()
    ?.find((m: any) => m.role === "assistant")?.content || "";

if (
  response &&
  lastAssistant &&
  lastAssistant.slice(0, 100) === response.slice(0, 100)
) {
  const variationOptions = [
    "Let’s go deeper — what’s the main bottleneck you're facing?",
    "Tell me more about your current setup so I can refine this.",
    "What part of your funnel or growth strategy feels weakest?",
  ];

  response =
    variationOptions[Math.floor(Math.random() * variationOptions.length)];

  modelUsed = "fallback";
}

/* ---------- SAVE MEMORY ---------- */

if (response) {
  await memoryService.saveMessage(sessionId, "assistant", response);
}

/* ---------- DEBUG LOG ---------- */

console.log(
  `[Hybrid RAG] Model=${modelUsed} | Stage=${brainContext.stage} | Intents=${detectedIntentNames.join(
    ","
  )} | Chunks=${vectorCount} | Service=${
    detectedService ?? "none"
  } | LeadScore=${brainContext.leadScore}`
);

/* ---------- RETURN ---------- */

return response;

} catch (err) {
  console.error("Hybrid RAG error:", err);
  return "Something went wrong on our side — try again in a moment.";
}
}
