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

function smartFallback(message: string): string {
  return `I couldn't fully generate a strong answer for that, but here's a quick direction:

Based on your input ("${message.slice(0, 60)}..."), you're likely looking for a strategic solution.

Let me refine this — are you focused more on:
• Getting more leads
• Improving conversions
• Scaling revenue

Tell me, and I’ll give you a precise breakdown.`;
}

function fixBrokenOutput(text: string): string {
  if (!text) return text;
  return text
    .replace(/\$1,(\s|$)/g, "$1000 ")
    .replace(/-win frameworks/g, "14-day rapid deployment")
    .replace(/within will work/g, "within 90 days")
    .replace(/\s+/g, " ")
    .trim();
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

  if (trimmed.length < 50) return true;
  if (!/[.!?]$/.test(trimmed)) return true;
  if (trimmed.includes("I'm having trouble")) return true;

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

  text = sanitizeTools(text);
  text = removeContactInfo(text);

  // 🔥 REMOVE NON-ENGLISH / BROKEN TOKENS (Chinese etc.)
  text = text.replace(/[^\x00-\x7F]+/g, " ");

  // 🔥 FIX COMMON MODEL SPELLING COLLAPSE
  const fixes: Record<string, string> = {
    trafic: "traffic",
    mised: "missed",
    vilas: "villas",
    Gogle: "Google",
    asistants: "assistants",
    enginer: "engineer",
    enginering: "engineering",
    se: "see",
    diferent: "different",
    busines: "business",
    acros: "across",
    tols: "tools",
    ned: "need",
    loking: "looking",
    kep: "keep",
    ganing: "gaining",
    ful: "full",
    funel: "funnel",
  };

  for (const [wrong, correct] of Object.entries(fixes)) {
    text = text.replace(new RegExp(`\\b${wrong}\\b`, "gi"), correct);
  }

  // formatting cleanup
  text = text.replace(/\b(AI-){2,}/gi, "AI-");
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // remove non-latin characters (fix Chinese bug)
text = text.replace(/[^\x00-\x7F]+/g, "");

// fix broken words spacing
text = text.replace(/\b([a-z])\s+([a-z])\b/gi, "$1$2");

return text.replace(/\s+/g, " ").trim();
}

function compressResponse(text: string): string {
  if (text.length < 1100) return text;
  const sentences = text.split(/[.!?]/).filter(Boolean);
  return sentences.slice(0, 6).join(". ") + ".";
}


function enforceResponseRules(text: string): string {
  if (!text) return text;

  return text
    .replace(/\$\d+,\s*/g, "")
    .replace(/CGI & Performance Pilot/gi, "our performance system")
    .replace(/I want to give you a precise answer — could you clarify[^.]*\./gi, "")
    .replace(/(.+?)\1{1,}/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
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
  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  if (msg.includes("book") || msg.includes("schedule") || msg.includes("meeting")) return { type: "booking" };
  if (greetingRegex.test(msg)) return { type: "greeting" };
  if (msg.includes("who are you")) return { type: "identity" };
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
    const { brainContext, chunks: strategicChunks = [] } = await strategicBrain(message, sessionId);
    await analyzeLeadSignals(message, sessionId);

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
    if (brain.type === "greeting") {
  return `Hey — glad you're here. What are you working on right now?`;
}
    
    /* ---------- HISTORY ---------- */
    const historyMessages = history.length > 0 ? history : await memoryService.getRecentContext(sessionId);
    const historyText = historyMessages.slice(-5).map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

    /* ---------- INTENT & SERVICE ---------- */
    let intentMatches: { intent: Intent; score?: number }[] = [];
    try { const detected = detectIntent(message); if (Array.isArray(detected)) intentMatches = detected; } catch {}
    const detectedIntentNames = intentMatches.length > 0 ? intentMatches.slice(0, 3).map((i) => i.intent.name) : ["general"];
    const intentCategories = intentMatches.map((i) => i.intent.category);

    let detectedService: string | null = null;
    try { detectedService = detectService(message); } catch {}

    /* ---------- VECTOR KNOWLEDGE ---------- */
    const expandedQueries = await expandQueryNeural(message, historyMessages.map((h) => h.content));
    const fusedChunks = await getFusedChunks(expandedQueries.join(" "), 4);
    const mergedChunks = [...strategicChunks, ...(fusedChunks || [])].filter((c, i, arr) => arr.findIndex((x) => x.text === c.text) === i);
    const vectorText = compressContext(mergedChunks);
    const vectorCount = mergedChunks.length;

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
const qwenPromise = withTimeout(generateOpenRouter(prompt), 8000);
const geminiPromise = canUseGemini()
  ? withTimeout(generateGemini(prompt), 6000)
  : Promise.resolve(null);

// ⚡ Wait for BOTH (ensures fallback safety + avoids undefined vars)
const [qwenResp, geminiResp] = await Promise.all([
  qwenPromise,
  geminiPromise,
]);

// 🎯 Priority: Qwen → Gemini (controlled + stable)
const candidates = [
  { resp: qwenResp, name: "Qwen" },
  { resp: geminiResp, name: "Gemini", mark: markGeminiUsed },
];

for (const c of candidates) {
  if (c.resp) {
    const cleaned = cleanResponse(c.resp);

    if (!looksIncomplete(cleaned)) {
      response = cleaned;
      modelUsed = c.name;

      if (c.mark) c.mark();
      break;
    }
  }
}

// 🛟 Final fallback (only if both fail)
if (!response) {
response = smartFallback(message);
  modelUsed = "fallback";
}

/* ---------- CLEANUP ---------- */

response = fixBrokenOutput(response);
response = enforceResponseRules(response);
response = compressResponse(response);
response = cleanHybridResponse(enforceBotName(response));

/* ---------- SMART CTA (DYNAMIC + CLEAN) ---------- */

if (
  shouldIncludeCTA(message, intentCategories, brainContext.leadScore, brainContext.stage) &&
  !response.toLowerCase().includes("map this")
) {
  response += "\n\n👉 If you'd like, I can map this into a clear execution plan tailored to your business.";
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
