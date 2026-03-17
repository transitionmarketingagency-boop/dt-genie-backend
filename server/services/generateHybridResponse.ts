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

/* ================= REQUEST TYPE ================= */

interface HybridRequest {
  message: string;
  sessionId: string;
  history?: any[];
}

/* ================= MAIN SYSTEM ================= */

export async function generateHybridResponse({
  message,
  sessionId,
  history = [],
}: HybridRequest): Promise<string> {

  try {

    /* ---------- STRATEGIC BRAIN ---------- */

    const { brainContext, chunks: strategicChunks = [] } =
      await strategicBrain(message, sessionId);

    await analyzeLeadSignals(message, sessionId);

    /* ---------- BOOKING CONTINUATION ---------- */

    if (bookingFlow.isBookingActive(sessionId)) {

      const bookingResp =
        await bookingFlow.handleStep(sessionId, message);

      await memoryService.saveMessage(
        sessionId,
        "assistant",
        bookingResp.response
      );

      return bookingResp.response;
    }

    /* ---------- SMART BOOKING TRIGGER ---------- */

    const autoBooking =
      await shouldTriggerBooking(sessionId, brainContext.stage);

    if (autoBooking && !bookingFlow.isBookingActive(sessionId)) {

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

      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and growth strategies.`;
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

      if (Array.isArray(detected))
        intentMatches = detected;

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

    /* ---------- VECTOR KNOWLEDGE ---------- */

    const expandedQueries =
      await expandQueryNeural(
        message,
        historyMessages.map((h) => h.content)
      );

    const fusedChunks =
      await getFusedChunks(
        expandedQueries.join(" "),
        4
      );

    const mergedChunks =
      [...strategicChunks, ...(fusedChunks || [])]
      .filter(
        (c, i, arr) =>
          arr.findIndex((x) => x.text === c.text) === i
      );

    const vectorText =
      compressContext(mergedChunks);

    const vectorCount =
      mergedChunks.length;

    /* ---------- STAGE INSTRUCTION ---------- */

    let stageInstruction = "";

    if (brainContext.stage === "discovery")
      stageInstruction =
        "Ask clarifying questions about the user's business.";

    if (brainContext.stage === "strategy")
      stageInstruction =
        "Provide strategic insights for business growth.";

    if (brainContext.stage === "service")
      stageInstruction =
        "Explain relevant services clearly.";

    if (brainContext.stage === "conversion")
      stageInstruction =
        "Encourage booking a consultation if helpful.";

    const bookingSignal =
      autoBooking
        ? "Encourage scheduling a consultation."
        : "";

    /* ---------- PROMPT ---------- */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

CRITICAL RULES:
Always answer the USER'S LATEST QUESTION.

STRICT KNOWLEDGE POLICY:
Only use the company knowledge provided below.

Do NOT invent:
• services
• tools
• pricing
• contact information
• phone numbers
• emails
• addresses

If information is not available in the knowledge base, say you do not have that information.

Detected service: ${detectedService ?? "general"}
Detected intents: ${detectedIntentNames.join(",")}

Conversation stage: ${brainContext.stage}
Lead score: ${brainContext.leadScore}

${stageInstruction}

${bookingSignal}

Company knowledge:
${vectorText}

Conversation history:
${historyText}

USER QUESTION:
${message}
`;

    /* ---------- MODEL EXECUTION ---------- */

    let response = "";
    let modelUsed = "none";

    const MAX_ATTEMPTS = 2;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {

      const qwenResp =
        await withTimeout(
          generateOpenRouter(prompt),
          18000
        );

      if (qwenResp) {

        const cleaned =
          cleanResponse(qwenResp);

        if (!looksIncomplete(cleaned)) {

          response = cleaned;

          modelUsed = "Qwen";

          break;
        }
      }
    }

    /* ---------- GEMINI FALLBACK ---------- */

    if (!response && canUseGemini()) {

      const geminiResp =
        await withTimeout(
          generateGemini(prompt),
          12000
        );

      if (geminiResp) {

        const cleaned =
          cleanResponse(geminiResp);

        if (!looksIncomplete(cleaned)) {

          response = cleaned;

          modelUsed = "Gemini";

          markGeminiUsed();
        }
      }
    }

    /* ---------- HARD FALLBACK ---------- */

    if (!response) {

      response =
        `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, performance advertising, and growth strategies.`;

      modelUsed = "fallback";
    }

    /* ---------- CLEANUP ---------- */

    response =
      compressResponse(response);

    response =
      cleanHybridResponse(
        enforceBotName(response)
      );

    await memoryService.saveMessage(
      sessionId,
      "assistant",
      response
    );

    console.log(
      `[Hybrid RAG] Model=${modelUsed} | Stage=${brainContext.stage} | Intents=${detectedIntentNames.join(
        ","
      )} | Chunks=${vectorCount} | Service=${detectedService ?? "none"} | LeadScore=${brainContext.leadScore}`
    );

    return response;

  } catch (err) {

    console.error("Hybrid RAG error:", err);

    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;
  }
}
