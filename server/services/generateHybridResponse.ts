// server/services/hybridResponse.ts
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
async function getEmbeddingKnowledge(
  userMessage: string,
  intent: string
): Promise<{ text: string; count: number }> {
  try {
    const allChunks = await getTopChunks(userMessage, 8, 0.5);
    if (!allChunks?.length) return { text: "", count: 0 };

    // Filter chunks by detected intent
    let filtered = allChunks.filter((c) => c.intent === intent);
    if (!filtered.length) filtered = allChunks;

    // Format chunks with explicit intent and source for AI reference
    const uniqueTexts = new Set<string>();
    const formattedChunks: string[] = [];

    for (const c of filtered) {
      const text = c?.text?.trim();
      if (!text || uniqueTexts.has(text)) continue;
      uniqueTexts.add(text);

      const src = c.source || "Digital Transition Marketing";
      const ci = c.intent || "general";

      // Explicitly mark intent and source for AI to reference
      formattedChunks.push(`- Intent: ${ci}, Source: ${src}\n  "${text}"`);
    }

    const arr = formattedChunks.slice(0, 4);
    return { text: arr.join("\n\n"), count: arr.length };
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return { text: "", count: 0 };
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
    const normalizedMessage = normalize(message);

    /* ===== BASIC INTENTS ===== */
    if (normalizedMessage.length < 15 && staticIntents.greeting.includes(normalizedMessage)) {
      return `Hello! I'm ${BOT_NAME}. How can I assist you today?`;
    }
    if (staticIntents.identity.some((t) => normalizedMessage.includes(normalize(t)))) {
      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing.`;
    }
    if (staticIntents.book.some((t) => normalizedMessage.includes(normalize(t)))) {
      return `Schedule a strategy session here:\nhttps://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;
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
      .map((h) => `User: ${h.role === "user" ? h.content : ""}\nAssistant: ${h.role === "assistant" ? h.content : ""}`)
      .join("\n");

    /* ===== INTENT DETECTION ===== */
    const detectedIntent = detectServiceIntent(message);

    /* ===== KNOWLEDGE RETRIEVAL ===== */
    const vector = await getEmbeddingKnowledge(message, detectedIntent);
    const jsonKnowledge = findMatchingIntent(message) ?? "";

    let knowledgePool = "";
    if (vector.text.length > 10) knowledgePool += `COMPANY KNOWLEDGE (referenced with intent and source):\n${vector.text}\n\n`;
    if (jsonKnowledge.length > 20) knowledgePool += `SUPPORTING INFORMATION:\n${jsonKnowledge}\n\n`;

    /* ===== PROMPT ===== */
    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Rules:
- Use COMPANY KNOWLEDGE when relevant, explicitly referencing the intent and source of each chunk.
- Do not invent company claims if knowledge is missing.
- Keep responses clear, helpful, and professional.

Detected intent: ${detectedIntent}

${knowledgePool}

Conversation history:
${historyText}

User question:
${message}

Provide a helpful response, explicitly referencing the intent of each relevant knowledge chunk.
`;

    /* ===== MODEL EXECUTION ===== */
    const MIN_RESPONSE_LENGTH = 40;
    let response = "";
    let modelUsed = "none";

    // Primary: OpenRouter Qwen
    if (process.env.OPENROUTER_API_KEY) {
      const qwenResp = await withTimeout(generateOpenRouter(prompt), 18000);
      if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(qwenResp);
        modelUsed = "Qwen";
      }
    }

    // Fallback: Gemini
    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {
      const geminiResp = await withTimeout(generateGemini(prompt), 12000);
      if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(geminiResp);
        modelUsed = "Gemini";
        markGeminiUsed();
      }
    }

    // Final fallback
    if (!response) {
      response = `I'm ${BOT_NAME}. I can assist with AI marketing systems, CGI ads, automation, SEO, and digital growth.`;
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

    console.log(`[Hybrid RAG] Model=${modelUsed} | Intent=${detectedIntent} | Chunks=${vector.count}`);
    return response;
  } catch (err) {
    console.error("Hybrid RAG error:", err);
    return `I'm ${BOT_NAME}. We're experiencing a temporary processing issue. Please try again shortly.`;
  }
}
