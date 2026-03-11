// server/services/generateHybridResponse.ts

import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { detectIntent, normalize, intents, Intent } from "./intentManager.js";

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

/* ================= VECTOR KNOWLEDGE ================= */
async function getEmbeddingKnowledge(userMessage: string, intentName: string): Promise<{ text: string; count: number }> {
  try {
    const queries = [userMessage, `${intentName} marketing`];
    const collected: any[] = [];
    for (const q of queries) {
      const chunks = await getTopChunks(q, 5, 0.78);
      if (chunks?.length) collected.push(...chunks);
    }
    if (!collected.length) return { text: "", count: 0 };
    const seen = new Set<string>();
    const arr: string[] = [];
    for (const c of collected) {
      const text = c?.text?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      arr.push(text);
    }
    return { text: arr.join("\n\n"), count: arr.length };
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return { text: "", count: 0 };
  }
}

/* ================= REQUEST TYPE ================= */
interface HybridRequest {
  message: string;
  sessionId: string;
  history?: any[];
}

/* ================= SERVICE EXAMPLES ================= */
function getRelevantServiceExamples(): string {
  const relevantServices = intents
    .filter((i) => i.category === "service")
    .map((i) => `- ${i.name.replace(/_/g, " ")}: ${i.description}`)
    .join("\n");
  return `Here are some of our top services:\n${relevantServices}\n`;
}

/* ================= MAIN HYBRID SYSTEM ================= */
export async function generateHybridResponse({ message, sessionId, history = [] }: HybridRequest): Promise<string> {
  try {
    const normalizedMessage = normalize(message);
    await memoryService.saveMessage(sessionId, "user", message);

    /* ================= BASIC STATIC INTENTS ================= */
    const greetings = ["hi", "hello", "hey"];
    const identityQueries = ["who are you", "about yourself", "tell me about yourself"];
    const bookingQueries = ["book", "schedule", "call", "meeting"];

    if (normalizedMessage.length < 15 && greetings.includes(normalizedMessage))
      return `Hello. I am ${BOT_NAME}. How can I assist you today?`;

    if (identityQueries.some((t) => normalizedMessage.includes(normalize(t))))
      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and digital growth strategies.`;

    if (bookingQueries.some((t) => normalizedMessage.includes(normalize(t))))
      return `You can schedule a strategy session here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;

    /* ================= MEMORY ================= */
    let historyMessages: any[] = [];
    try {
      historyMessages = await memoryService.getRecentContext(sessionId);
    } catch {
      historyMessages = history.slice(-8);
    }
    historyMessages = [
      ...historyMessages.filter((h) => h.role === "assistant"),
      ...historyMessages.filter((h) => h.role === "user").slice(-2),
    ];
    const historyText = historyMessages.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");

    /* ================= INTENT DETECTION ================= */
    const intentMatches = detectIntent(message) ?? [];
    const topIntent: Intent | null = intentMatches[0]?.intent ?? null;
    const detectedIntent = topIntent?.name ?? "general";
    const intentDescription = topIntent?.description ? `Intent info: ${topIntent.description}\n\n` : "";

    /* ================= KNOWLEDGE POOL ================= */
    const vector = await getEmbeddingKnowledge(message, detectedIntent);
    let knowledgePool = "";
    if (vector.text.length > 10) knowledgePool += `Company knowledge:\n${vector.text}\n\n`;
    if (intentDescription) knowledgePool += intentDescription;

    /* ================= SERVICE EXAMPLES ================= */
    const serviceExamples = getRelevantServiceExamples();

    /* ================= PROMPT ================= */
    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Rules:
- Only promote services offered by Digital Transition Marketing.
- Never recommend external AI tools, platforms, or services.
- Only describe services present in company knowledge.
- Do not invent guarantees, statistics, pricing, phone numbers, or email addresses.
- Respond professionally in clear natural paragraphs.
- Use the user's intent description and company knowledge to make responses precise and context-aware.
- Include examples, use persuasive language, but remain factual.
- Incorporate relevant services where appropriate.
- Highlight the top detected intent: "${detectedIntent}".
- If unsure, rely on company knowledge and do not hallucinate.

${knowledgePool}
${serviceExamples}

Conversation history:
${historyText}

User question:
${message}

Provide a concise, professional, highly relevant response (80-150 words). Prioritize actionable insights, service alignment, and specific examples from our services.
`;

    /* ================= MODEL EXECUTION ================= */
    const MIN_RESPONSE_LENGTH = 80;
    const MAX_ATTEMPTS = 2;
    let response = "";
    let modelUsed = "none";

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (process.env.OPENROUTER_API_KEY) {
        const qwenResp = await withTimeout(generateOpenRouter(prompt), 18000);
        if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {
          response = cleanResponse(qwenResp);
          modelUsed = "Qwen";
          break;
        }
      }
    }

    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {
      const geminiResp = await withTimeout(generateGemini(prompt), 12000);
      if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(geminiResp);
        modelUsed = "Gemini";
        markGeminiUsed();
      }
    }

    if (!response) {
      response = `I am ${BOT_NAME}. I help businesses implement AI marketing systems, performance advertising, automation, SEO, and digital growth strategies through Digital Transition Marketing.`;
      modelUsed = "fallback";
    }

    response = enforceBotName(response);
    await memoryService.saveMessage(sessionId, "assistant", response);

    console.log(`[Hybrid RAG] Model=${modelUsed} | Intent=${detectedIntent} | Chunks=${vector.count}`);
    return response;

  } catch (err) {
    console.error("Hybrid RAG error:", err);
    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;
  }
}
