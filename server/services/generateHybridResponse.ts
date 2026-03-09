import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { aiIntents } from "./json_loader.js";

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

/* ================= NORMALIZATION ================= */

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/* ================= STATIC INTENTS ================= */

const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  book: ["book", "schedule", "call", "meeting"],
};

const greetingVariations = [
  `Hello! I'm ${BOT_NAME}. How can I assist you today?`,
  `Hi there! I'm ${BOT_NAME}, ready to help with your digital growth.`,
  `Greetings! I'm ${BOT_NAME}, AI strategist for Digital Transition Marketing.`,
];

/* ================= JSON INTENT MATCH ================= */

function findMatchingIntent(userMessage: string): string | null {
  const msg = normalize(userMessage);
  const msgWords = msg.split(" ");

  let bestMatch: { score: number; response: string } | null = null;

  for (const intent of aiIntents) {
    if (!intent?.triggers?.length || !intent?.responses?.length) continue;

    let score = 0;

    for (const trig of intent.triggers) {
      const trigWords = normalize(trig).split(" ");
      const overlap = trigWords.filter((w) => msgWords.includes(w)).length;

      score += trigWords.length ? overlap / trigWords.length : 0;
    }

    if (score > 0.55 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        score,
        response: intent.responses.filter(Boolean).join("\n\n"),
      };
    }
  }

  return bestMatch?.response ?? null;
}

/* ================= VECTOR KNOWLEDGE ================= */

async function getEmbeddingKnowledge(userMessage: string): Promise<string> {
  try {

    // LOWERED SIMILARITY THRESHOLD
    const chunks: any[] = await getTopChunks(userMessage, 6, 0.60);

    if (!chunks?.length) return "";

    const texts: string[] = [];

    for (const c of chunks) {
      if (!c?.text) continue;

      const cleaned = c.text.trim();

      if (!texts.includes(cleaned)) {
        texts.push(cleaned);
      }
    }

    return texts.slice(0, 5).join("\n\n");

  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return "";
  }
}

/* ================= TIMEOUT WRAPPER ================= */

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

/* ================= REQUEST TYPE ================= */

interface HybridRequest {
  message: string;
  sessionId: string;
  history?: any[];
}

/* ================= MAIN HYBRID SYSTEM ================= */

export async function generateHybridResponse({
  message,
  sessionId,
  history = [],
}: HybridRequest): Promise<string> {

  try {

    const msg = normalize(message);

    /* ===== BASIC INTENTS ===== */

    if (staticIntents.greeting.some((t) => msg.includes(t))) {
      return greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
    }

    if (staticIntents.identity.some((t) => msg.includes(normalize(t)))) {
      return `I am ${BOT_NAME}, the AI strategist for Digital Transition Marketing. I specialize in AI-powered marketing systems, automation, performance advertising, CGI property marketing, and SEO strategy.`;
    }

    if (staticIntents.book.some((t) => msg.includes(t))) {
      return `You can schedule a strategy session here:
https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;
    }

    /* ===== MEMORY HISTORY ===== */

    let memoryHistory: any[] = [];

    try {
      memoryHistory = await memoryService.getHistory(sessionId);
    } catch {
      memoryHistory = history || [];
    }

    const historyText = memoryHistory
      .slice(-6)
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    /* ===== KNOWLEDGE SOURCES ===== */

    const vectorKnowledge = await getEmbeddingKnowledge(message);

    const jsonKnowledge = findMatchingIntent(message) ?? "";

    let knowledgePool = "";

    // VECTOR KNOWLEDGE FIRST (MOST IMPORTANT)
    if (vectorKnowledge.length > 20) {
      knowledgePool += `COMPANY KNOWLEDGE:\n${vectorKnowledge}\n\n`;
    }

    // INTENT KNOWLEDGE SECONDARY
    if (jsonKnowledge.length > 20) {
      knowledgePool += `SUPPORTING INFO:\n${jsonKnowledge}\n\n`;
    }

    /* ===== PROMPT ===== */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

You answer questions about the company's marketing services,
AI automation systems, CGI advertising, SEO strategy, and digital growth.

Use the COMPANY KNOWLEDGE to answer questions whenever possible.

If the answer is not fully available, give the best helpful explanation
based on the available context.

Be professional, confident, and concise.

--------------------------------

${knowledgePool}

--------------------------------

Conversation context:
${historyText}

--------------------------------

User question:
${message}

--------------------------------

Answer clearly and helpfully.
`;

    const MIN_RESPONSE_LENGTH = 60;

    let response = "";
    let modelUsed = "none";

    /* ===== PRIMARY MODEL ===== */

    if (process.env.OPENROUTER_API_KEY) {

      const qwenResp = await withTimeout(
        generateOpenRouter(prompt),
        12000
      );

      if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(qwenResp);
        modelUsed = "Qwen";
      }

    }

    /* ===== FALLBACK MODEL ===== */

    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {

      const geminiResp = await withTimeout(
        generateGemini(prompt),
        10000
      );

      if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(geminiResp);
        modelUsed = "Gemini";
        markGeminiUsed();
      }

    }

    /* ===== SAFE FALLBACK ===== */

    if (!response) {
      response = `I'm ${BOT_NAME}. I can assist with AI marketing systems, CGI advertising, automation, SEO strategy, and digital growth services. What would you like to know?`;
      modelUsed = "fallback";
    }

    response = enforceBotName(response);

    /* ===== SAVE MEMORY ===== */

    try {

      await memoryService.saveMessage(sessionId, "user", message);
      await memoryService.saveMessage(sessionId, "assistant", response);

    } catch {
      console.warn("Memory save failed");
    }

    console.log(`[Hybrid RAG] Model=${modelUsed}`);

    return response;

  } catch (err) {

    console.error("Hybrid RAG error:", err);

    return `I'm ${BOT_NAME}. We're experiencing a temporary processing issue. Please try again shortly.`;
  }
}
