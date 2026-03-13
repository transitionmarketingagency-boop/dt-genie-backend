import { getFusedChunks } from "../services/intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { detectIntent, normalize, Intent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";

/* ================= GEMINI CONFIG ================= */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);

const GEMINI_DAILY_LIMIT = 20;

let geminiUsage = {
  count: 0,
  lastReset: Date.now()
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

/* ================= TIMEOUT ================= */

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {

  return new Promise(resolve => {

    const timer = setTimeout(() => resolve(null), ms);

    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });

  });
}

/* ================= CONTEXT COMPRESSION ================= */

const MAX_CONTEXT_CHARS = 1800;

function compressContext(chunks: any[], maxLength: number = 320): string {

  if (!chunks?.length) return "";

  const seen = new Set<string>();

  const context = chunks
    .map((c, i) => {

      const txt = c?.text
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);

      if (!txt || seen.has(txt)) return "";

      seen.add(txt);

      return `[Knowledge ${i + 1}] ${txt}`;

    })
    .filter(Boolean)
    .join("\n");

  return context.slice(0, MAX_CONTEXT_CHARS);
}

/* ================= NEURAL QUERY EXPANSION ================= */

async function expandQueryNeural(
  userMessage: string,
  history: string[] = []
): Promise<string[]> {

  const normalized = userMessage.trim().toLowerCase();

  const expansions = [normalized];

  const words = normalized.split(" ").slice(0, 5);

  if (words.length > 1) {

    expansions.push(`${words.join(" ")} marketing`);
    expansions.push(`${words.join(" ")} service`);
    expansions.push(`${words.join(" ")} strategy`);
    expansions.push(`${words.join(" ")} implementation`);

  }

  history.slice(-2).forEach(h =>
    expansions.push(h.toLowerCase())
  );

  return Array.from(new Set(expansions));
}

/* ================= VECTOR KNOWLEDGE ================= */

async function getEmbeddingKnowledge(
  userMessage: string,
  history: string[] = []
): Promise<{ text: string; count: number }> {

  try {

    await expandQueryNeural(userMessage, history);

    const fusedChunks = await getFusedChunks(userMessage, 4);

    if (!fusedChunks?.length) {
      return { text: "", count: 0 };
    }

    const compressed = compressContext(fusedChunks);

    return {
      text: compressed,
      count: fusedChunks.length
    };

  } catch (err) {

    console.error("Fused embedding retrieval error:", err);

    return { text: "", count: 0 };

  }

}

/* ================= RESPONSE VALIDATION ================= */

function looksIncomplete(text: string): boolean {

  if (!text) return true;

  const trimmed = text.trim();

  return trimmed.length < 40 || !/[.!?]$/.test(trimmed);

}

/* ================= TOOL SANITIZER ================= */

function sanitizeTools(text: string): string {

  const toolMap: Record<string, string> = {

    "Creatify": "advanced AI content systems",
    "Wisepops": "AI marketing automation tools",
    "AdCreative.ai": "AI ad optimization systems",
    "AIclicks.io": "AI performance tracking tools",
    "OpenAI": "proprietary AI systems",
    "Midjourney": "proprietary AI systems"

  };

  for (const [tool, replacement] of Object.entries(toolMap)) {

    text = text.replace(
      new RegExp(`\\b${tool}\\b`, "gi"),
      replacement
    );

  }

  return text;

}

/* ================= RESPONSE CLEANUP ================= */

function cleanHybridResponse(text: string): string {

  text = sanitizeTools(text);

  text = text.replace(/\b(AI-){2,}/gi, "AI-");

  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  text = text.replace(/\bIll\b/g, "I'll");

  return text.replace(/\s+/g, " ").trim();

}

/* ================= RESPONSE LENGTH CONTROL ================= */

function compressResponse(text: string): string {

  if (text.length < 900) return text;

  const sentences = text.split(/[.!?]/);

  return sentences.slice(0, 4).join(". ") + ".";

}

/* ================= NEURAL BRAIN LAYER ================= */

function neuralBrain(message: string) {

  const msg = message.toLowerCase();

  if (
    msg.includes("book") ||
    msg.includes("schedule") ||
    msg.includes("meeting")
  ) {

    return {
      type: "booking"
    };

  }

  if (
    msg.includes("hi") ||
    msg.includes("hello") ||
    msg.includes("hey")
  ) {

    return {
      type: "greeting"
    };

  }

  if (msg.includes("who are you")) {

    return {
      type: "identity"
    };

  }

  return {
    type: "normal"
  };

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
  history = []

}: HybridRequest): Promise<string> {

  try {

    const normalizedMessage = normalize(message);

    await memoryService.saveMessage(
      sessionId,
      "user",
      message
    );

    /* ================= NEURAL BRAIN ================= */

    const brain = neuralBrain(message);

    /* ================= GREETING ================= */

    if (brain.type === "greeting") {

      const previous =
        await memoryService.getRecentContext(sessionId);

      const greetedAlready = previous.some(
        (m: any) =>
          m.role === "assistant" &&
          m.content?.includes("Hello")
      );

      if (greetedAlready) {
        return "Hello again. How can I assist you?";
      }

      return `Hello. I am ${BOT_NAME}. How can I assist you today?`;

    }

    /* ================= IDENTITY ================= */

    if (brain.type === "identity") {

      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and growth strategies.`;

    }

    /* ================= BOOKING START ================= */

    if (brain.type === "booking") {

      return `I'd be happy to help you schedule a strategy session.

What would you like to discuss?

• AI marketing
• CGI property tours
• SEO / GEO
• General consultation`;

    }

    /* ================= MEMORY ================= */

    let historyMessages: any[] = [];

    try {

      historyMessages =
        await memoryService.getRecentContext(sessionId);

    } catch {

      historyMessages = history.slice(-6);

    }

    const historyText = historyMessages
      .slice(-5)
      .map(
        h =>
          `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`
      )
      .join("\n");

    /* ================= INTENT & SERVICE ================= */

    let intentMatches: {
      intent: Intent;
      score?: number;
    }[] = [];

    try {

      const detected = detectIntent(message);

      if (Array.isArray(detected)) {
        intentMatches = detected;
      }

    } catch {}

    const detectedIntentNames =
      intentMatches.length > 0
        ? intentMatches
            .slice(0, 3)
            .map(i => i.intent.name)
        : ["general"];

    let detectedService: string | null = null;

    try {

      detectedService = detectService(message);

    } catch {}

    /* ================= VECTOR KNOWLEDGE ================= */

    const vector = await getEmbeddingKnowledge(
      message,
      historyMessages.map(h => h.content)
    );

    /* ================= PROMPT ================= */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

CRITICAL RULE:
Always answer the USER'S LATEST QUESTION.

STRICT KNOWLEDGE RULES:
• Only use company knowledge provided.
• Do NOT invent services or tools.

Detected service focus:
${detectedService ?? "general"}

Detected intents:
${detectedIntentNames.join(", ")}

Company knowledge:
${vector.text}

Conversation history:
${historyText}

USER QUESTION:
${message}

Provide a clear helpful answer.
`;

    /* ================= MODEL EXECUTION ================= */

    let response = "";
    let modelUsed = "none";

    const MAX_ATTEMPTS = 2;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {

      if (process.env.OPENROUTER_API_KEY) {

        const qwenResp =
          await withTimeout(
            generateOpenRouter(prompt),
            15000
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

    }

    /* ================= GEMINI FALLBACK ================= */

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

    /* ================= HARD FALLBACK ================= */

    if (!response) {

      response =
        `I am ${BOT_NAME}. I help businesses implement AI-powered marketing systems, automation workflows, predictive analytics, immersive digital experiences, and performance advertising through Digital Transition Marketing.`;

      modelUsed = "fallback";

    }

    /* ================= FINAL CLEANUP ================= */

    response = compressResponse(response);

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
      `[Hybrid RAG] Model=${modelUsed} | Intents=${detectedIntentNames.join(",")} | Chunks=${vector.count} | Service=${detectedService ?? "none"} | ResponseLen=${response.length}`
    );

    return response;

  } catch (err) {

    console.error("Hybrid RAG error:", err);

    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;

  }

}
