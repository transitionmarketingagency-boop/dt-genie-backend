// server/services/generateHybridResponse.ts

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

let geminiUsage = {
  count: 0,
  lastReset: Date.now(),
};

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

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

/* ================= STATIC INTENTS ================= */

const staticIntents = {

  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  book: ["book", "schedule", "call"]

};

const greetingVariations = [

  `Hello! I'm ${BOT_NAME}, how can I assist you today?`,
  `Hi there! I'm ${BOT_NAME}, ready to help with your digital growth.`,
  `Greetings! I'm ${BOT_NAME}, AI strategist for Digital Transition Marketing.`

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

      const overlap = trigWords.filter(w => msgWords.includes(w)).length;

      score += trigWords.length ? overlap / trigWords.length : 0;

    }

    if (score > 0.35 && (!bestMatch || score > bestMatch.score)) {

      bestMatch = {
        score,
        response: intent.responses.filter(Boolean).join("\n\n")
      };

    }

  }

  return bestMatch?.response ?? null;

}

/* ================= VECTOR KNOWLEDGE (CHUNKS) ================= */

async function getEmbeddingKnowledge(userMessage: string): Promise<string> {

  try {

    const chunks: any[] = await getTopChunks(userMessage, 10, 0.32);

    if (!chunks?.length) return "";

    const texts: string[] = [];

    for (const c of chunks) {

      if (!c?.text) continue;

      const trimmed = c.text.slice(0, 650).trim();

      if (!texts.includes(trimmed)) texts.push(trimmed);

    }

    return texts.slice(0, 7).join("\n\n");

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

/* ================= MAIN SEMANTIC + INTENT RESPONSE ================= */

export async function generateHybridResponse({

  message,
  sessionId,
  history = []

}: HybridRequest): Promise<string> {

  try {

    const msg = normalize(message);

    /* ===== GREETING ===== */

    if (staticIntents.greeting.some(t => msg.includes(t))) {

      return greetingVariations[
        Math.floor(Math.random() * greetingVariations.length)
      ];

    }

    /* ===== IDENTITY ===== */

    if (staticIntents.identity.some(t => msg.includes(normalize(t)))) {

      return `I am ${BOT_NAME}, the AI strategist for Digital Transition Marketing. I specialize in AI-powered marketing systems, automation, performance advertising, CGI property marketing, SEO systems, and digital growth strategies.`;

    }

    /* ===== BOOKING ===== */

    if (staticIntents.book.some(t => msg.includes(t))) {

      return `You can schedule a strategy session here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;

    }

    /* ===== MEMORY HISTORY ===== */

    let memoryHistory: any[] = [];

    try {
      memoryHistory = await memoryService.getHistory(sessionId);
    }
    catch {
      memoryHistory = history || [];
    }

    const historyText = memoryHistory
      .slice(-6)
      .map((h: any) => `${h.role}: ${h.content}`)
      .join("\n");

    /* ===== SEMANTIC RAG KNOWLEDGE ===== */

    const jsonKnowledge = findMatchingIntent(message) ?? "";
    const embeddingKnowledge = await getEmbeddingKnowledge(message);

    let knowledgePool = "";

    if (jsonKnowledge.length > 20) {

      knowledgePool += `\n\nINTENT KNOWLEDGE:\n${jsonKnowledge}\n`;

    }

    if (embeddingKnowledge.length > 20) {

      knowledgePool += `\n\nCHUNK KNOWLEDGE BASE:\n${embeddingKnowledge}\n`;

    }

/* ===== PROMPT CONSTRUCTION ===== */

const prompt = `
SYSTEM ROLE
You are ${BOT_NAME}, the AI strategist for Digital Transition Marketing.

Your role is to help users understand digital growth, marketing systems,
automation, AI marketing, CGI property marketing, and SEO strategy.

----------------------------------------

KNOWLEDGE SOURCES

You may ONLY use the knowledge provided below when answering company-specific questions.

If the knowledge does not contain the answer,
respond professionally but DO NOT invent services or pricing.

${knowledgePool}

----------------------------------------

RESPONSE GUIDELINES

1. Always respond as ${BOT_NAME}.
2. Never mention DT Genie.
3. Never invent services, pricing, or company details.
4. Use the provided knowledge chunks when relevant.
5. Explain ideas clearly in a professional but friendly tone.
6. If helpful, structure answers using short paragraphs or bullet points.
7. If the user asks about services, explain benefits rather than listing generic marketing advice.

----------------------------------------

CONVERSATION CONTEXT

${historyText}

----------------------------------------

USER QUESTION

${message}

----------------------------------------

RESPONSE FORMAT

Provide a helpful, professional response as ${BOT_NAME}.
Use clear explanations and practical insights when appropriate.
`;

    const MIN_RESPONSE_LENGTH = 80;

    let response = "";
    let modelUsed = "none";

    /* ===== PRIMARY MODEL ===== */

    if (process.env.OPENROUTER_API_KEY) {

      try {

        console.log("⚡ Using primary model: Qwen");

        const qwenResp = await withTimeout(
          generateOpenRouter(prompt),
          12000
        );

        if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {

          response = cleanResponse(qwenResp);
          modelUsed = "Qwen";

        }

      } catch (err) {

        console.error("Qwen error:", err);

      }

    }

    /* ===== FALLBACK MODEL ===== */

    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {

      try {

        console.log("⚡ Using fallback model: Gemini");

        const geminiResp = await withTimeout(
          generateGemini(prompt),
          10000
        );

        if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {

          response = cleanResponse(geminiResp);
          modelUsed = "Gemini";

          markGeminiUsed();

        }

      } catch (err) {

        console.error("Gemini error:", err);

      }

    }

    /* ===== SAFE FALLBACK ===== */

    if (!response) {

      response = `I'm ${BOT_NAME}, AI strategist for Digital Transition Marketing. I can assist with AI marketing systems, automation, CGI property tours, SEO strategy, and digital growth. How can I help you today?`;

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
