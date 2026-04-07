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
    msg.includes("stop") ||
    msg.includes("just exploring") ||
    msg.includes("not interested")
  );
}

/* ================= SMART FALLBACK (UPGRADED) ================= */

function smartFallback(message: string, context: string = ""): string {
  const msg = message.toLowerCase();

  // ❌ avoid generic repeated pattern (CORE BUG FIX)
  if (context && context.length > 40) {
    return `Here’s what’s actually happening in your case:

${context}

The fastest way forward is identifying the exact bottleneck and fixing that layer directly.`;
  }

  if (msg.includes("traffic") && msg.includes("sales")) {
    return "You don’t have a traffic problem — you have a conversion leak. This usually comes from weak messaging, poor offer clarity, or funnel friction. Fix the drop-off point first.";
  }

  if (msg.includes("roas") || msg.includes("ads")) {
    return "ROAS drops during scaling usually mean creative fatigue or audience saturation. The fix is refreshing creatives and restructuring targeting — not just increasing budget.";
  }

  if (msg.length < 10) {
    return "Give me a bit more context — I’ll map a precise strategy for you.";
  }

  // ❌ REMOVE GENERIC TEMPLATE LOOP (major issue in your logs)
  return `The issue isn’t random — it’s coming from one of three layers:

1. Traffic quality
2. Conversion system
3. Messaging alignment

Tell me your current setup — I’ll pinpoint the exact bottleneck.`;
}

/* ================= CTA LOGIC (UPGRADED) ================= */

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
    lower.includes("consultation") ||
    lower.includes("hire") ||
    lower.includes("start");

  const highIntent =
    leadScore >= 6 || // lowered slightly for better triggering
    stage === "service" ||
    stage === "conversion";

  // ❌ prevent CTA spam on weak/general queries
  if (intentCategories.includes("general") && leadScore < 5) return false;

  return explicitIntent || highIntent;
}

/* ================= GEMINI CONFIG ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED =
  typeof GEMINI_API_KEY === "string" && GEMINI_API_KEY.length > 20;

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

const MAX_CONTEXT_CHARS = 1400; // increased slightly for better intelligence

function compressContext(chunks: any[], maxLength: number = 320): string {
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

/* ================= RESPONSE VALIDATION (CRITICAL FIX) ================= */

function looksIncomplete(text: string): boolean {
  if (!text) return true;

  const trimmed = text.trim();

  // ❌ previous logic was rejecting too aggressively (causing fallback spam)

  if (trimmed.length < 15) return true;

  // allow conversational endings
  if (!/[.!?]$/.test(trimmed) && trimmed.length < 60) return false;

  // detect cut-off
  if (/[,$:]$/.test(trimmed)) return true;

  if (/\$\s*$/.test(trimmed)) return true;

  // detect corrupted output
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed)) return true;

  if (
    trimmed.toLowerCase().includes("couldn't generate") ||
    trimmed.toLowerCase().includes("something went wrong")
  ) {
    return true;
  }

  if (!/[a-zA-Z]/.test(trimmed)) return true;

  return false;
}

/* ================= SANITIZATION ================= */

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

  // normalize spacing
  text = text.replace(/\s+/g, " ");

  return text.trim();
}

/* ================= QUALITY FILTER ================= */

function isLowQuality(text: string): boolean {
  if (!text) return true;

  if (text.length < 20) return true;
  if (text.split(" ").length < 6) return true;

  if (
    text.includes("I'm having trouble") ||
    text.includes("something went wrong")
  ) {
    return true;
  }

  return false;
}

/* ================= RESPONSE COMPRESSION ================= */

function compressResponse(text: string): string {
  if (text.length < 1200) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;

  const selected = sentences.slice(0, 6).join(" ").trim();

  return /[.!?]$/.test(selected) ? selected : selected + ".";
}

/* ================= QUERY EXPANSION (IMPROVED) ================= */

async function expandQueryNeural(userMessage: string, history: string[] = []) {
  const normalized = userMessage.trim().toLowerCase();
  const expansions = [normalized];

  const words = normalized.split(" ").slice(0, 6);

  if (words.length > 1) {
    const base = words.join(" ");

    expansions.push(`${base} marketing strategy`);
    expansions.push(`${base} service solution`);
    expansions.push(`${base} business growth`);
    expansions.push(`${base} conversion optimization`);
  }

  history.slice(-2).forEach((h) => expansions.push(h.toLowerCase()));

  return Array.from(new Set(expansions));
}


/* ================= NEURAL BRAIN ================= */

function neuralBrain(message: string) {
  const msg = message.trim().toLowerCase();

  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  // ✅ STRONG BOOKING INTENT (tightened)
  if (
    /(book|schedule|appointment|consultation|call|hire|work with you|start now|let's start|ready to proceed)/i.test(msg)
  ) {
    return { type: "booking" };
  }

  if (msg.includes("who are you")) {
    return { type: "identity" };
  }

  // ✅ GREETING ONLY IF VERY SHORT (prevents spam)
  if (greetingRegex.test(msg) && msg.split(" ").length <= 3) {
    return { type: "greeting" };
  }

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

    /* ---------- CACHE ---------- */
    const recentMessagesCache =
      history.length > 0
        ? history
        : await memoryService.getRecentContext(sessionId).catch(() => []);

    const brain = neuralBrain(message);

    /* ---------- STRATEGIC BRAIN + LEAD ---------- */
    const [brainData, leadData] = await Promise.all([
      strategicBrain(message, sessionId),
      analyzeLeadSignals(message, sessionId),
    ]);

    const brainContext = brainData?.brainContext ?? {};
    const strategicChunks = brainData?.chunks ?? [];

    /* ---------- FIX: LEAD SCORE NORMALIZATION ---------- */
    let leadScoreValue = 0;

    if (typeof leadData?.score?.total === "number") {
      leadScoreValue = leadData.score.total;
    } else if (typeof brainContext?.leadScore === "number") {
      leadScoreValue = brainContext.leadScore;
    }

    // ✅ FORCE 0–1 RANGE (CRITICAL FIX)
    if (leadScoreValue > 1) {
      leadScoreValue = Math.min(leadScoreValue / 10, 1);
    }

    /* ---------- FIX: STAGE ---------- */
    const stage =
      typeof brainContext?.stage === "string"
        ? brainContext.stage
        : "discovery";

    brainContext.leadScore = leadScoreValue;
    brainContext.stage = stage;

/* ---------- GLOBAL SAFE VARIABLES (CRITICAL FIX) ---------- */
let detectedIntentNames: string[] = ["general"];
let intentCategories: string[] = [];
let detectedService: string | null = null;
let vectorCount = 0;
let forceNoQuestions = false;

    /* ---------- 🔥 EXECUTION MODE (FIXED ROOT ISSUE) ---------- */
    brainContext.executionMode =
      leadScoreValue >= 0.6 ||
      stage === "service" ||
      stage === "conversion"
        ? "execution"
        : "exploration";

    console.log(
      `[MODE] executionMode=${brainContext.executionMode} | leadScore=${leadScoreValue} | stage=${stage}`
    );

    const lowerMsg = message.toLowerCase();

    /* ---------- BOOKING FLOW ACTIVE ---------- */
    if (bookingFlow.isBookingActive(sessionId)) {

      if (detectBookingRejection(message)) {
        bookingFlow.reset(sessionId);
        return "No problem — we can continue here. What would you like to explore?";
      }

      const bookingResp = await bookingFlow.handleStep(sessionId, message);

      // ✅ FIX: prevent crash loop
      if (!bookingResp || !bookingResp.response) {
        bookingFlow.reset(sessionId);
        return "Something broke in scheduling — let’s restart. Just say 'book a call'.";
      }

      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

    /* ---------- NEURAL ROUTING ---------- */

    if (brain.type === "identity") {
      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing.`;
    }

    if (brain.type === "booking") {
      const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

    /* ---------- SMART GREETING (FIXED HARD BUG) ---------- */

    if (brain.type === "greeting") {
      const hasContext =
        brainContext?.hasSufficientContext ||
        leadScoreValue > 0.3;

      const hasAssistantSpoken = recentMessagesCache.some(
        (m: any) => m.role === "assistant"
      );

      // ❌ BLOCK greeting if convo already started
      if (!hasContext && !hasAssistantSpoken) {

        if (brainContext?.dynamicGreeting) {
          return brainContext.dynamicGreeting;
        }

        const hour = new Date().getHours();
        const greeting =
          hour < 12 ? "Good morning" :
          hour < 18 ? "Good afternoon" :
          "Good evening";

        return `${greeting} — what are you trying to improve right now?`;
      }
    }

    console.log(`Lead Score Value: ${leadScoreValue}`);

    /* ---------- 🔥 SMART AUTO BOOKING (FIXED ROOT LOGIC) ---------- */

    const isInformationalQuery =
      /(what|how|why|explain|tell me|can you|do you)/i.test(lowerMsg);

    const hasStrongBuyingIntent =
      /(hire|start|work with you|ready|book|schedule)/i.test(lowerMsg);

    const autoBooking =
      (await shouldTriggerBooking(sessionId, stage as any)) &&
      leadScoreValue >= 0.6 &&
      (hasStrongBuyingIntent || !isInformationalQuery);

    if (
      autoBooking &&
      !bookingFlow.isBookingActive(sessionId)
    ) {
      const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

    /* ---------- HIGH INTENT OVERRIDE ---------- */

    if (
      /(hire you|work with you|get started|start working)/i.test(lowerMsg)
    ) {
      const bookingResp = await bookingFlow.startBookingFlow(sessionId, message);
      await memoryService.saveMessage(sessionId, "assistant", bookingResp.response);
      return bookingResp.response;
    }

    /* ---------- HISTORY ---------- */

    const historyMessages =
      recentMessagesCache?.length
        ? recentMessagesCache
        : Array.isArray(history)
        ? history
        : [];

    const historyText = historyMessages
      .slice(-2)
      .map(
        (h: any) =>
          `${h.role === "user" ? "User" : "Assistant"}: ${h.content || ""}`
      )
      .join("\n");

    /* ---------- INTENT ---------- */

let intentMatches: { intent: Intent; score?: number }[] = [];

try {
  const detected = detectIntent(message);
  if (Array.isArray(detected)) intentMatches = detected;
} catch {}

detectedIntentNames =
  intentMatches.length > 0
    ? intentMatches.slice(0, 3).map((i) => i.intent.name)
    : ["general"];

intentCategories =
  intentMatches.length > 0
    ? intentMatches.map((i) => i.intent.category)
    : [];

/* ---------- VECTOR SEARCH (FIXED QUALITY) ---------- */

// Expand query (multi-angle retrieval)
const expandedQueries = await expandQueryNeural(
  message,
  historyMessages.map((h) => h.content)
);

// Fetch fused chunks
const fusedChunks = await getFusedChunks(
  expandedQueries.join(" "),
  4
);

/* ---------- MERGE + PRIORITIZE + DEDUPE (INTELLIGENT) ---------- */

const allChunks = [
  ...strategicChunks.map((c: any) => ({
    ...c,
    priority: 2,
    source: "strategic",
  })),
  ...(fusedChunks || []).map((c: any) => ({
    ...c,
    priority: 1,
    source: "vector",
  })),
];

const deduped = new Map<string, any>();

for (const c of allChunks) {
  if (!c?.text) continue;

  const key = c.text.trim();

  if (!deduped.has(key)) {
    deduped.set(key, c);
  } else {
    const existing = deduped.get(key);

    // ✅ Keep higher priority chunk
    if ((c.priority || 0) > (existing.priority || 0)) {
      deduped.set(key, c);
    }
  }
}

/* ---------- FINAL SORT (BEST FIRST) ---------- */

const mergedChunks = Array.from(deduped.values())
  .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  .slice(0, 5);

/* ---------- CONTEXT BUILD ---------- */

const vectorText = compressContext(mergedChunks, 220);

// ✅ FIX: REQUIRED GLOBAL VARIABLE
vectorCount = mergedChunks.length;

/* ---------- HARD RESPONSES (FAST PATH) ---------- */

if (lowerMsg.includes("your company") || lowerMsg.includes("about you")) {
  return "Digital Transition Marketing is an AI-powered growth agency focused on building high-performance marketing systems — from performance marketing and automation to predictive analytics and CGI-driven campaigns. We don’t just run ads — we engineer scalable growth systems.";
}

if (lowerMsg.includes("cost") || lowerMsg.includes("price")) {
  return "Pricing depends on scope and ROI targets — we structure it based on performance and outcomes, not fixed packages. Tell me your goal and I’ll break down what it would realistically cost.";
}

/* ---------- PROMPT (ELITE FIXED VERSION) ---------- */

const avoidQuestions =
  brainContext.hasSufficientContext &&
  brainContext.stage !== "discovery";

/* ---------- CONTEXT BLOCK ---------- */

const knownContext = `
Known User Context:
${historyText}

Industry: ${brainContext.strategicMemory?.industry || "unknown"}
Business Type: ${brainContext.strategicMemory?.businessType || "unknown"}

IMPORTANT:
- Do NOT ask for information already provided
- Use this context to MOVE FORWARD (not repeat questions)
`;

/* ---------- PROMPT ---------- */

const prompt = `
You are ${BOT_NAME}, a senior AI growth strategist from Digital Transition Marketing.

You think like a top 1% consultant — not a chatbot.

=====================================
🔥 CORE OBJECTIVE
=====================================
Solve the user's REAL business problem using strategy, not generic advice.

=====================================
🚨 HARD RULES (NON-NEGOTIABLE)
=====================================
- NEVER give generic advice like:
  "use content marketing + ads + optimization"
- NEVER repeat previous responses
- NEVER ignore provided context
- NEVER ask the same question again
- NEVER reset the conversation direction
- NEVER output vague frameworks without specificity

- ALWAYS:
  → Diagnose the ROOT problem
  → Give SPECIFIC, EXECUTABLE actions
  → Tie everything to RESULTS (revenue, leads, ROAS)

=====================================
🧠 INTELLIGENCE MODE
=====================================
Execution Mode: ${brainContext.executionMode}

IF executionMode = "execution":
- DO NOT ask unnecessary questions
- Give DIRECT implementation steps
- Move toward action, plan, or next step

IF executionMode = "exploration":
- Diagnose deeply
- Ask MAX 1 high-value question (only if needed)

${avoidQuestions ? "CRITICAL: DO NOT ASK ANY QUESTIONS." : ""}

=====================================
📊 USER CONTEXT (HIGHEST PRIORITY)
=====================================
Stage: ${brainContext.stage}
Lead Score: ${brainContext.leadScore}
Intent: ${detectedIntentNames.join(",")}
Services: ${brainContext.detectedServices?.join(", ") || "adaptive"}

Strategic Insight:
${brainContext.reasoning}

User Maturity:
${brainContext.leadScore > 0.6 ? "HIGH INTENT (ready to act)" : "EXPLORING"}

=====================================
🧩 KNOWN CONTEXT
=====================================
${knownContext}

=====================================
📚 KNOWLEDGE (USE THIS, NOT GENERIC MEMORY)
=====================================
${vectorText}

=====================================
👤 USER MESSAGE
=====================================
${message}

=====================================
🧠 THINKING INSTRUCTIONS (CRITICAL)
=====================================
Before answering:

1. What is the REAL underlying problem?
2. What is the fastest path to measurable improvement?
3. What exact actions will move results?

=====================================
✍️ RESPONSE STRUCTURE (MANDATORY)
=====================================

1. Identify the REAL problem (specific, not generic)
2. Give a CLEAR, EXECUTABLE solution
   - steps
   - tactics
   - strategy tied to outcome
3. (Optional) ONE sharp follow-up question ONLY if needed

=====================================
🚫 ANTI-GENERIC ENFORCEMENT
=====================================

❌ BAD:
"Use SEO, ads, and content marketing"

✅ GOOD:
"Your YouTube ads are underperforming because your hook fails in the first 3 seconds — fix this by testing 5 new opening angles targeting [specific audience]"

=====================================
🎯 FINAL RULES
=====================================

- Be sharp, direct, and strategic
- Sound like a human expert
- Avoid fluff, filler, repetition
- Prefer depth over surface-level advice
- If context exists → MOVE FORWARD, don’t reset
`;


/* ---------- HYBRID MODEL EXECUTION (STABLE + INTELLIGENT) ---------- */

let response = "";
let modelUsed = "none";

/* ---------- PRIMARY MODEL (QWEN) ---------- */
const qwenResp = await withTimeout(generateOpenRouter(prompt, sessionId), 6500);

/* ---------- QUALITY CHECK ---------- */
const qwenBad =
  !qwenResp ||
  isLowQuality(qwenResp) ||
  looksIncomplete(qwenResp);

/* ---------- SECONDARY MODEL (GEMINI) ---------- */
let geminiResp: string | null = null;

// 🔥 STRICT ESCALATION (FIXED)
if (
  qwenBad &&
  brainContext.hasSufficientContext &&
  message.length > 20 &&
  canUseGemini()
) {
  geminiResp = await withTimeout(generateGemini(prompt), 4500);
}

/* ---------- MODEL SELECTION ---------- */

// ✅ Prefer STRONG response only
if (qwenResp && !qwenBad) {
  response = qwenResp;
  modelUsed = "Qwen";
} else if (geminiResp && !looksIncomplete(geminiResp)) {
  response = geminiResp;
  modelUsed = "Gemini";
  markGeminiUsed();
}

/* ---------- HARD GUARD: EMPTY RESPONSE ---------- */
if (!response) {
  response = "";
}

/* ---------- PREVENT GENERIC DOWNGRADE ---------- */
if (response && brainContext.hasSufficientContext) {
  response = response.replace(
    /(tell me more|let me know more|share more details).*$/gi,
    ""
  );
}

/* ---------- FINAL FALLBACK (SMART — NON GENERIC) ---------- */

if (!response || isLowQuality(response) || looksIncomplete(response)) {

  let fallback = "";

  if (brainContext.hasSufficientContext) {
    fallback = `Let’s move this forward.

Based on what you've shared, the issue isn’t strategy — it’s execution.

${brainContext.reasoning || "We need to refine what's already working instead of restarting."}

The next step is identifying the weakest point in your funnel and optimizing that directly.`;
  }

  else if (brainContext.leadScore > 0.3) {
    fallback = `This looks like a structural bottleneck rather than a strategy issue.

You’re likely losing performance at one of these layers:
- Conversion flow
- Offer positioning
- Traffic quality

Fixing the right layer will unlock growth much faster.`;
  }

  else {
    const options = [
      "Tell me the exact result you're trying to achieve — I’ll map the fastest path.",
      "What’s the main bottleneck you're facing right now?",
      "Give me your goal and I’ll break it down properly."
    ];

    fallback = options[Math.floor(Math.random() * options.length)];
  }

  response = fallback.trim();
  modelUsed = "fallback";
}

/* ---------- CLEANUP (NON-DESTRUCTIVE) ---------- */

response = removeContactInfo(response);

response = response
  .replace(/\s+/g, " ")
  .replace(/\s([.,!?])/g, "$1")
  .replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, "")
  .trim();

/* ---------- SAFE RETRY (ONLY IF CRITICAL FAILURE) ---------- */

if (
  modelUsed === "Qwen" &&
  (isLowQuality(response) || looksIncomplete(response)) &&
  canUseGemini()
) {
  console.log("⚠️ Retrying with Gemini (quality fail)");

  const retry = await withTimeout(generateGemini(prompt), 4000);

  if (retry && !isLowQuality(retry)) {
    response = cleanResponse(retry);
    modelUsed = "Gemini-retry";
  }
}

/* ---------- NO-QUESTION ENFORCEMENT (SOFT — NOT DESTRUCTIVE) ---------- */

if (forceNoQuestions && response) {
  response = response.replace(/\?+/g, ".");
}

/* ---------- LENGTH CONTROL ---------- */

if (response.length > 1200) {
  response = compressResponse(response);
}

/* ---------- IDENTITY ENFORCEMENT ---------- */

response = enforceBotName(response);

/* ---------- SMART CTA (CONTROLLED) ---------- */

if (
  response &&
  shouldIncludeCTA(
    message,
    intentCategories,
    brainContext.leadScore,
    brainContext.stage
  ) &&
  brainContext.hasSufficientContext
) {
  const ctas = [
    "We can turn this into a structured execution plan if you want.",
    "I can map this into a step-by-step growth plan for your setup.",
    "Want me to break this into an actionable plan tailored to your business?"
  ];

  response = response.replace(/[.!\s]*$/, "");
  response += "\n\n" + ctas[Math.floor(Math.random() * ctas.length)];
}

/* ---------- ANTI-REPETITION (FIXED SMART VERSION) ---------- */

const lastMessages = recentMessagesCache;

const lastAssistant =
  lastMessages
    ?.slice()
    ?.reverse()
    ?.find((m: any) => m.role === "assistant")?.content || "";

if (response && lastAssistant) {
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

  const prev = normalize(lastAssistant).slice(0, 140);
  const curr = normalize(response).slice(0, 140);

  const isSimilar =
    prev === curr ||
    prev.includes(curr.slice(0, 80)) ||
    curr.includes(prev.slice(0, 80));

  if (isSimilar) {
    if (brainContext.hasSufficientContext) {
      response = `Let’s take this further.

${brainContext.reasoning || "We now need to refine execution instead of rethinking strategy."}

Focus on fixing the highest-impact bottleneck first.`;
    } else {
      response = "Let’s focus this properly — what’s the main result you're trying to achieve?";
    }

    modelUsed = "anti-repeat";
  }
}

/* ---------- SAVE MEMORY ---------- */
if (response) {
  await memoryService.saveMessage(sessionId, "assistant", response);
}

/* ---------- DEBUG ---------- */
console.log(
  `[Hybrid RAG] Model=${modelUsed} | Stage=${brainContext.stage} | Chunks=${vectorCount} | LeadScore=${brainContext.leadScore}`
);

/* ---------- RETURN ---------- */
return response;

} catch (err) {
  console.error("Hybrid RAG error:", err);
  return "Something went wrong on our side — try again in a moment.";
}
}

/* ================= HYBRID RESPONSE SERVICE ================= */
export const hybridResponseService = {
  detectServices: (message: string): string[] => {
    if (!message || typeof message !== "string") return [];

    const lowered = message.toLowerCase();
    const servicesSet = new Set<string>();

    const mappings: { regex: RegExp; service: string }[] = [
      { regex: /voice|vso|position zero|featured snippets/, service: "Voice Search Optimization (VSO)" },
      { regex: /email|ai-powered email|automation|klaviyo/, service: "AI-Powered Email Marketing" },
      { regex: /youtube|video funnel|ad domination|ai-optimized scripts/, service: "AI-Powered YouTube Ad Domination" },
      { regex: /website|web design|mobile-first|seo|core web vitals/, service: "AI-Powered Website Design" },
      { regex: /360 tour|virtual tour|nerf|mortgage calculator/, service: "AI Virtual Tours" },
      { regex: /performance marketing|ad warfare|algorithmic bidding|predictive audience/, service: "AI-Powered Ad Warfare (Performance Marketing)" },
      { regex: /automation|ai agents|self-healing|pre-trained llama|workflow/, service: "AI Business Automation & AI Agents" },
      { regex: /music|audio|mixing|mastering|track production/, service: "Next-Level Music Production" },
      { regex: /cgi|immersive|cinematic|3d animation|photorealistic/, service: "Immersive CGI Marketing" },
      { regex: /video production|audio production|spatial audio|voiceover/, service: "AI Video and Audio Production" },
      { regex: /content|blog|script|case study|ai-optimized content/, service: "AI-Optimized Content" },
      { regex: /social|linkedin|reels|community management|shadowban/, service: "AI-Powered Social Domination" },
      { regex: /geo|ai seo|generative engine|search domination/, service: "AI Search Domination (GEO & AI SEO)" },
      { regex: /predictive analytics|hedge fund|sentiment analysis|dark pool/, service: "AI Predictive Analytics" },
    ];

    for (const { regex, service } of mappings) {
      if (regex.test(lowered)) servicesSet.add(service);
    }

    return Array.from(servicesSet);
  },
};
