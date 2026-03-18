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

/* ================= NEW: SAFETY HELPERS ================= */

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

function smartFallback(): string {
  return `I want to give you a precise answer — could you clarify what specific outcome you're aiming for? For example: more leads, conversions, or scaling revenue?`;
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

function applyHighIntentBoost(text: string, leadScore: number): string {
  if (leadScore < 0.75) return text;

  return (
    text +
    "\n\n👉 If you're serious about results, the fastest way forward is to map this to your business in a quick strategy call."
  );
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
  return trimmed.length < 40 || !/[.!?]$/.test(trimmed);
}

/* ================= TOOL SANITIZER ================= */

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

/* ================= CONTACT BLOCKER ================= */

function removeContactInfo(text: string): string {
  if (!text) return "";

  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "");
  text = text.replace(/\+?\d[\d\s-]{7,}\d/g, "");
  text = text.replace(/\d{1,5}\s\w+(\s\w+){0,5},?\s\w{2,20}/gi, "");
  text = text.replace(
    /(contact us at|reach us at|email us at|call us at)[^.]*\./gi,
    ""
  );

  return text;
}

function cleanHybridResponse(text: string): string {
  text = sanitizeTools(text);
  text = removeContactInfo(text);
  text = text.replace(/\b(AI-){2,}/gi, "AI-");
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  text = text.replace(/\bIll\b/g, "I'll");
  return text.replace(/\s+/g, " ").trim();
}

function compressResponse(text: string): string {
  if (text.length < 1100) return text;
  const sentences = text.split(/[.!?]/).filter(Boolean);
  return sentences.slice(0, 6).join(". ") + ".";
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

  const greetingRegex =
    /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

  if (msg.includes("book") || msg.includes("schedule") || msg.includes("meeting"))
    return { type: "booking" };

  if (greetingRegex.test(msg))
    return { type: "greeting" };

  if (msg.includes("who are you"))
    return { type: "identity" };

  return { type: "normal" };
}

/* ================= MAIN SYSTEM ================= */

export async function generateHybridResponse({
  message,
  sessionId,
  history = [],
}: any): Promise<string> {
  try {
    const { brainContext, chunks: strategicChunks = [] } =
      await strategicBrain(message, sessionId);

    await analyzeLeadSignals(message, sessionId);

    /* ---------- BOOKING CONTINUATION FIX ---------- */

    if (bookingFlow.isBookingActive(sessionId)) {
      if (detectBookingRejection(message)) {
        bookingFlow.reset(sessionId);
        return "No problem — we can continue here. What would you like to explore?";
      }

      const bookingResp = await bookingFlow.handleStep(sessionId, message);

      await memoryService.saveMessage(
        sessionId,
        "assistant",
        bookingResp.response
      );

      return bookingResp.response;
    }

    /* ---------- SMART BOOKING TRIGGER FIX ---------- */

    const autoBooking =
      await shouldTriggerBooking(sessionId, brainContext.stage);

    if (
      autoBooking &&
      !bookingFlow.isBookingActive(sessionId) &&
      !detectBookingRejection(message)
    ) {
      const bookingResp =
        await bookingFlow.startBookingFlow(sessionId, message);

      await memoryService.saveMessage(
        sessionId,
        "assistant",
        bookingResp.response
      );

      return bookingResp.response;
    }

    /* ---------- NEURAL BRAIN ---------- */

    const brain = neuralBrain(message);

    if (brain.type === "identity") {
      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing.`;
    }

    if (brain.type === "booking") {
      const bookingResp =
        await bookingFlow.startBookingFlow(sessionId, message);

      await memoryService.saveMessage(
        sessionId,
        "assistant",
        bookingResp.response
      );

      return bookingResp.response;
    }

    /* ---------- HISTORY ---------- */

    const historyMessages =
      history.length > 0
        ? history
        : await memoryService.getRecentContext(sessionId);

    const historyText =
      historyMessages
        .slice(-5)
        .map(
          (h) =>
            `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`
        )
        .join("\n");

    /* ---------- INTENT ---------- */

    let intentMatches: { intent: Intent; score?: number }[] = [];

    try {
      const detected = detectIntent(message);
      if (Array.isArray(detected)) intentMatches = detected;
    } catch {}

    const detectedIntentNames =
      intentMatches.length > 0
        ? intentMatches.slice(0, 3).map((i) => i.intent.name)
        : ["general"];

    /* ---------- SERVICE ---------- */

    let detectedService: string | null = null;

    try {
      detectedService = detectService(message);
    } catch {}

    /* ---------- VECTOR ---------- */

    const expandedQueries =
      await expandQueryNeural(
        message,
        historyMessages.map((h) => h.content)
      );

    const fusedChunks =
      await getFusedChunks(expandedQueries.join(" "), 4);

    const mergedChunks =
      [...strategicChunks, ...(fusedChunks || [])]
      .filter(
        (c, i, arr) =>
          arr.findIndex((x) => x.text === c.text) === i
      );

    const vectorText = compressContext(mergedChunks);

    const vectorCount = mergedChunks.length;

    /* ---------- PROMPT ---------- */

    const prompt = `
You are ${BOT_NAME}, AI strategist.

Answer clearly and strategically.

Intent: ${detectedIntentNames.join(",")}
Service: ${detectedService ?? "general"}

Stage: ${brainContext.stage}
Lead score: ${brainContext.leadScore}

Context:
${vectorText}

Conversation:
${historyText}

User:
${message}
`;

    /* ---------- MODEL EXECUTION ---------- */

    let response = "";
    let modelUsed = "none";

    const MAX_ATTEMPTS = 2;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const qwenResp =
        await withTimeout(generateOpenRouter(prompt), 18000);

      if (qwenResp) {
        const cleaned = cleanResponse(qwenResp);
        if (!looksIncomplete(cleaned)) {
          response = cleaned;
          modelUsed = "Qwen";
          break;
        }
      }
    }

    /* ---------- GEMINI ---------- */

    if (!response && canUseGemini()) {
      const geminiResp =
        await withTimeout(generateGemini(prompt), 12000);

      if (geminiResp) {
        const cleaned = cleanResponse(geminiResp);
        if (!looksIncomplete(cleaned)) {
          response = cleaned;
          modelUsed = "Gemini";
          markGeminiUsed();
        }
      }
    }

    /* ---------- SMART FALLBACK ---------- */

    if (!response) {
      response = smartFallback();
      modelUsed = "fallback";
    }

    /* ---------- CLEANUP ---------- */

    response = fixBrokenOutput(response);
    response = compressResponse(response);
    response = cleanHybridResponse(enforceBotName(response));
    response = applyHighIntentBoost(response, brainContext.leadScore);

    await memoryService.saveMessage(sessionId, "assistant", response);

    console.log(
      `[Hybrid RAG] Model=${modelUsed} | Stage=${brainContext.stage} | Intents=${detectedIntentNames.join(
        ","
      )} | Chunks=${vectorCount} | Service=${detectedService ?? "none"} | LeadScore=${brainContext.leadScore}`
    );

    return response;
  } catch (err) {
    console.error("Hybrid RAG error:", err);
    return `There was a temporary processing issue. Please try again shortly.`;
  }
}
