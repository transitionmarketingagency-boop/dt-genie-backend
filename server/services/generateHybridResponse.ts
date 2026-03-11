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
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================= BASIC INTENTS ================= */

const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  book: ["book", "schedule", "call", "meeting"],
};

/* ================= SERVICE INTENT DETECTION ================= */

const serviceIntents = [
  { keyword: "youtube ads", intent: "youtube_ads" },
  { keyword: "cgi ads", intent: "cgi_ads" },
  { keyword: "seo", intent: "seo" },
  { keyword: "vso", intent: "vso" },
  { keyword: "email marketing", intent: "email_marketing" },
];

function detectServiceIntent(text: string): string {
  const t = normalize(text);

  for (const s of serviceIntents) {
    if (t.includes(s.keyword)) return s.intent;
  }

  return "general";
}

/* ================= JSON INTENT MATCH ================= */

function findMatchingIntent(userMessage: string): string | null {
  const msgWords = normalize(userMessage).split(" ");

  let bestMatch: { score: number; response: string } | null = null;

  for (const intent of aiIntents) {
    if (!intent?.triggers?.length || !intent?.responses?.length) continue;

    let score = 0;

    for (const trig of intent.triggers) {
      const trigWords = normalize(trig).split(" ");

      const overlap = trigWords.filter((w) =>
        msgWords.includes(w)
      ).length;

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

async function getEmbeddingKnowledge(
  userMessage: string,
  intent: string
): Promise<{ text: string; count: number }> {
  try {
    const allChunks = await getTopChunks(userMessage, 4, 0.65);

    if (!allChunks?.length) return { text: "", count: 0 };

    let filtered = allChunks.filter((c) => c.intent === intent);
    if (!filtered.length) filtered = allChunks;

    const uniqueTexts = new Set<string>();
    const formattedChunks: string[] = [];

    for (const c of filtered) {
      const text = c?.text?.trim();

      if (!text || uniqueTexts.has(text)) continue;

      uniqueTexts.add(text);

      // CLEAN CHUNKS (NO SOURCE / INTENT METADATA)
      formattedChunks.push(text);
    }

    const arr = formattedChunks.slice(0, 4);

    return {
      text: arr.join("\n\n"),
      count: arr.length,
    };
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return { text: "", count: 0 };
  }
}

/* ================= TIMEOUT WRAPPER ================= */

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
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
    const normalizedMessage = normalize(message);

    /* ===== BASIC INTENTS ===== */

    if (
      normalizedMessage.length < 15 &&
      staticIntents.greeting.includes(normalizedMessage)
    ) {
      return `Hello. I am ${BOT_NAME}. How can I assist you today?`;
    }

    if (
      staticIntents.identity.some((t) =>
        normalizedMessage.includes(normalize(t))
      )
    ) {
      return `I am ${BOT_NAME}, the AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and digital growth strategies.`;
    }

    if (
      staticIntents.book.some((t) =>
        normalizedMessage.includes(normalize(t))
      )
    ) {
      return `You can schedule a strategy session here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;
    }

    /* ===== MEMORY HISTORY ===== */

    let memoryHistory: any[] = [];

    try {
      memoryHistory = await memoryService.getHistory(sessionId);
    } catch {
      memoryHistory = history || [];
    }

    const recentMessages = memoryHistory.slice(-6);

    const historyText = recentMessages
      .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
      .join("\n");

    /* ===== INTENT DETECTION ===== */

    const detectedIntent = detectServiceIntent(message);

    /* ===== KNOWLEDGE RETRIEVAL ===== */

    const vector = await getEmbeddingKnowledge(message, detectedIntent);

    const jsonKnowledge = findMatchingIntent(message) ?? "";

    let knowledgePool = "";

    if (vector.text.length > 10)
      knowledgePool += `Company knowledge:\n${vector.text}\n\n`;

    if (jsonKnowledge.length > 20)
      knowledgePool += `Supporting information:\n${jsonKnowledge}\n\n`;

    /* ===== PROMPT ===== */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Rules:

Respond in clean professional paragraphs.
Do not use emojis, bullet symbols, hashtags, markdown, or decorative formatting.
Do not mention sources, internal data, or system processes.
Do not greet the user again unless it is the first message.
Only introduce yourself once at the beginning of a conversation.
Use the company knowledge when relevant.
If knowledge is missing, answer generally without inventing company claims.

Relevant service category: ${detectedIntent}

${knowledgePool}

Conversation history:
${historyText}

User question:
${message}

Provide a helpful, accurate, and professional answer.
`;

    /* ===== MODEL EXECUTION ===== */

    const MIN_RESPONSE_LENGTH = 40;

    let response = "";
    let modelUsed = "none";

    /* ===== PRIMARY MODEL (QWEN) ===== */

    if (process.env.OPENROUTER_API_KEY) {
      const qwenResp = await withTimeout(
        generateOpenRouter(prompt),
        22000
      );

      if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(qwenResp);
        modelUsed = "Qwen";
      }
    }

    /* ===== GEMINI FALLBACK ===== */

    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {
      const geminiResp = await withTimeout(
        generateGemini(prompt),
        12000
      );

      if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(geminiResp);
        modelUsed = "Gemini";
        markGeminiUsed();
      }
    }

    /* ===== FINAL FALLBACK ===== */

    if (!response) {
      response = `I am ${BOT_NAME}. I assist businesses with AI marketing systems, automation, SEO, performance advertising, and digital growth strategies.`;
      modelUsed = "fallback";
    }

    response = enforceBotName(response);

    /* ===== MEMORY SAVE ===== */

    try {
      await memoryService.saveMessage(sessionId, "user", message);
      await memoryService.saveMessage(sessionId, "assistant", response);
    } catch {
      console.warn("Memory save failed");
    }

    console.log(
      `[Hybrid RAG] Model=${modelUsed} | Intent=${detectedIntent} | Chunks=${vector.count}`
    );

    return response;
  } catch (err) {
    console.error("Hybrid RAG error:", err);

    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;
  }
}
