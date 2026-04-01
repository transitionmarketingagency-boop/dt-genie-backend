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

  // Dynamic fallback instead of generic loop
return `You're likely facing a strategy misalignment rather than a single-channel issue.

The fastest way to fix this is to identify:
- Where your funnel is breaking
- Whether the issue is traffic quality or conversion
- And how your messaging aligns with user intent

If you want, I can break this down specifically for your business and map a clear execution plan.`;
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


if (trimmed.length < 25) return true;

// Allow incomplete punctuation if content is strong
if (trimmed.length < 60 && !/[.!?]$/.test(trimmed)) return true;

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
  if (text.length < 40) return true;
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
  if (greetingRegex.test(msg) && msg.length < 5) {
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

    const autoBooking = await shouldTriggerBooking(sessionId, brainContext.stage);
    if (autoBooking && !bookingFlow.isBookingActive(sessionId) && !detectBookingRejection(message)) {
      const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
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

if (brain.type === "greeting" && message.trim().length < 10) {
  const greetings = [
    "What are you currently trying to grow or improve?",
    "Tell me — what’s your main focus right now?",
    "What kind of results are you aiming for?",
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

    /* ---------- HISTORY ---------- */
    const historyMessages: any[] =
  Array.isArray(history) && history.length > 0
    ? history
    : await memoryService.getRecentContext(sessionId) || [];
    const historyText = historyMessages
  .slice(-3)
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
const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

ROLE:
You help businesses grow using AI-powered marketing systems, focusing on results, strategy, and conversion.

CRITICAL RULES:
- Only use provided context (no guessing pricing or services)
- If pricing is missing → explain value instead
- Be natural, human, and strategic (not robotic)
- Avoid repetition and generic answers
- Focus on solving the user's business problem
- DO NOT over-focus on one service (like GEO)
- Dynamically choose from ALL services:
  (SEO, Performance Marketing, CGI Ads, Automation, Analytics, Content, Branding)
- Recommend combinations, not single solutions

USER ANALYSIS:
- Intent: ${detectedIntentNames.join(",")}
- Service Interest: ${detectedService ?? "multi-service"}
- Available Services: GEO, Performance Marketing, AI Automation, Content, Branding, Web Development, CGI Ads, Analytics
- Do NOT over-focus on one service (like SEO/GEO); adapt based on user problem
- Mention relevant services dynamically, not repeatedly
- Funnel Stage: ${brainContext.stage}
- Lead Score: ${brainContext.leadScore}
- Strategy Insight: ${brainContext.reasoning}

KNOWLEDGE:
${vectorText}

CONVERSATION:
${historyText}

USER MESSAGE:
${message}

INSTRUCTIONS:
- Give a clear, useful, and tailored answer
- If user shows intent → guide toward solution
- If high intent → naturally move toward next step (no hard sell)
- Keep it concise but impactful
`;

/* ---------- HYBRID MODEL EXECUTION (FAST + RELIABLE) ---------- */

let response = "";
let modelUsed = "none";

// Run both models in parallel (fast timeouts)
const qwenPromise = withTimeout(generateOpenRouter(prompt), 6500);

const geminiPromise = canUseGemini()
  ? withTimeout(generateGemini(prompt), 4500)
  : Promise.resolve(null);

// ⚡ Wait for BOTH (ensures fallback safety + avoids undefined vars)
const qwenResp = await qwenPromise;

let geminiResp: string | null = null;

if (!qwenResp && canUseGemini()) {
  geminiResp = await geminiPromise;
}

// Priority: Qwen -> Gemini (controlled + stable)

if (qwenResp && !looksIncomplete(qwenResp)) {
  response = qwenResp;
  modelUsed = "Qwen";
} else if (geminiResp && !looksIncomplete(geminiResp)) {
  response = geminiResp;
  modelUsed = "Gemini";
  markGeminiUsed();
}

// Final fallback (only if both fail OR response is weak)
if (!response) {
  response = smartFallback(message);
  modelUsed = "fallback";
}

/* ---------- CLEANUP (STABLE + NON-DESTRUCTIVE) ---------- */

response = removeContactInfo(response);

response = response
  .replace(/\s+/g, " ")
  .replace(/\s([.,!?])/g, "$1")
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

if (response.length > 1200) {
  response = compressResponse(response);
}

/* ---------- FINAL IDENTITY ENFORCEMENT ---------- */

response = enforceBotName(response);


/* ---------- SMART CTA (DYNAMIC + CLEAN) ---------- */

if (
  shouldIncludeCTA(message, intentCategories, brainContext.leadScore, brainContext.stage)
) {
  response = response.replace(/\.*$/, "");
  response += ".\n\nIf you'd like, I can map this into a clear execution plan tailored to your business.";
}

/* ---------- SAVE MEMORY ---------- */

await memoryService.saveMessage(sessionId, "assistant", response);

/* ---------- DEBUG LOG (FIXED) ---------- */

console.log(
  `[Hybrid RAG] Model=${modelUsed} | Stage=${brainContext.stage} | Intents=${detectedIntentNames.join(",")} | Chunks=${vectorCount} | Service=${detectedService ?? "none"} | LeadScore=${brainContext.leadScore}`
);




/* ---------- RETURN ---------- */

return response;

} catch (err) {
  console.error("Hybrid RAG error:", err);
  return "There was a temporary processing issue. Please try again shortly.";
}
}
