// server/services/generateHybridResponse.ts

import { getFusedChunks } from "../services/intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { detectIntent, normalize, Intent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";
import { strategicBrain } from "./strategicBrain.js";

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

const MAX_CONTEXT_CHARS = 1800;

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

function looksIncomplete(text: string): boolean {
  if (!text) return true;

  const trimmed = text.trim();

  return trimmed.length < 40 || !/[.!?]$/.test(trimmed);
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

function cleanHybridResponse(text: string): string {
  text = sanitizeTools(text);
  text = text.replace(/\b(AI-){2,}/gi, "AI-");
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  text = text.replace(/\bIll\b/g, "I'll");

  return text.replace(/\s+/g, " ").trim();
}

function compressResponse(text: string): string {
  if (text.length < 900) return text;

  const sentences = text.split(/[.!?]/).filter(Boolean);

  return sentences.slice(0, 4).join(". ") + ".";
}

/* ================= QUERY EXPANSION ================= */

async function expandQueryNeural(userMessage: string, history: string[] = []): Promise<string[]> {

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

/* ================= VECTOR KNOWLEDGE ================= */

async function getEmbeddingKnowledge(userMessage: string, history: string[] = []) {

  try {
    await expandQueryNeural(userMessage, history);

    const fusedChunks = await getFusedChunks(userMessage, 4);

    if (!fusedChunks?.length) return { text: "", count: 0 };

    const compressed = compressContext(fusedChunks);

    return {
      text: compressed,
      count: fusedChunks.length,
    };
  } catch (err) {
    console.error("Fused embedding retrieval error:", err);

    return {
      text: "",
      count: 0,
    };
  }
}

/* ================= NEURAL BRAIN ================= */

function neuralBrain(message: string) {

  const msg = message.trim().toLowerCase();

  const greetingRegex = /^(hi|hello|hey|good morning|good afternoon|good evening)$/i;

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

/* ================= MAIN HYBRID SYSTEM ================= */

export async function generateHybridResponse({ message, sessionId, history = [] }: HybridRequest): Promise<string> {

  try {

    await memoryService.saveMessage(sessionId, "user", message);

    /* ---------- STRATEGIC BRAIN ---------- */

    const { brainContext, chunks: strategicChunks } =
      await strategicBrain(message, sessionId);

    /* ---------- NEURAL BRAIN ---------- */

    const brain = neuralBrain(message);

    /* ---------- GREETING ---------- */

    if (brain.type === "greeting") {

      const previous = await memoryService.getRecentContext(sessionId);

      const greetedAlready = previous.some(
        (m: any) =>
          m.role === "assistant" &&
          m.content?.includes("Hello")
      );

      return greetedAlready
        ? "Hello again. How can I assist you?"
        : `Hello. I am ${BOT_NAME}. How can I assist you today?`;
    }

    /* ---------- IDENTITY ---------- */

    if (brain.type === "identity") {

      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and growth strategies.`;
    }

    /* ---------- BOOKING ---------- */

    if (brain.type === "booking") {

      return `You can schedule a strategy session with our team.\n\nWhat would you like to discuss?\n\n• AI marketing\n• CGI property tours\n• SEO / GEO\n• General consultation`;
    }

    /* ---------- CONTEXT HISTORY ---------- */

    let historyMessages: any[] = [];

    try {
      historyMessages =
        await memoryService.getRecentContext(sessionId);
    } catch {
      historyMessages = history.slice(-6);
    }

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
        ? intentMatches
            .slice(0, 3)
            .map((i) => i.intent.name)
        : ["general"];

    /* ---------- SERVICE ---------- */

    let detectedService: string | null = null;

    try {
      detectedService = detectService(message);
    } catch {}

    /* ---------- VECTOR KNOWLEDGE ---------- */

    const vector =
      await getEmbeddingKnowledge(
        message,
        historyMessages.map((h) => h.content)
      );

    const vectorText =
      compressContext([
        ...strategicChunks,
        { text: vector.text },
      ]);

    const vectorCount =
      strategicChunks.length + vector.count;

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
        "Encourage booking a consultation.";

    /* ---------- SERVICE RECOMMENDATION ---------- */

    const recommendedServiceText =
      brainContext.recommendedService
        ? `Recommended service focus: ${brainContext.recommendedService}`
        : "";

    /* ---------- BOOKING SIGNAL ---------- */

    const bookingSignal =
      brainContext.triggerBooking
        ? "If appropriate, encourage the user to schedule a consultation."
        : "";

    /* ---------- PROMPT ---------- */

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

CRITICAL RULE:
Always answer the USER'S LATEST QUESTION.

STRICT KNOWLEDGE RULES:
Only use the company knowledge provided below.
If information is not present in the knowledge, say you do not have that information.
Do NOT invent services, tools, pricing, or guarantees.

Detected service focus: ${detectedService ?? "general"}
Detected intents: ${detectedIntentNames.join(",")}
Conversation stage: ${brainContext.stage}
Lead score: ${brainContext.leadScore}
Deal probability: ${brainContext.dealProbability ?? "unknown"}

${stageInstruction}

${recommendedServiceText}

${bookingSignal}

Reasoning: ${brainContext.reasoning ?? "General inquiry"}

Company knowledge:
${vectorText}

Conversation history:
${historyText}

USER QUESTION:
${message}

Provide a clear, helpful response aligned with the user's intent and stage.
`;

    /* ---------- MODEL EXECUTION ---------- */

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

          const cleaned = cleanResponse(qwenResp);

          if (!looksIncomplete(cleaned)) {

            response = cleaned;
            modelUsed = "Qwen";

            break;
          }
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

        const cleaned = cleanResponse(geminiResp);

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
        `I am ${BOT_NAME}. I help businesses implement AI-powered marketing systems, automation workflows, predictive analytics, immersive digital experiences, and performance advertising through Digital Transition Marketing.`;

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
      )} | Chunks=${vectorCount} | Service=${detectedService ?? "none"} | LeadScore=${brainContext.leadScore} | ResponseLen=${response.length}`
    );

    return response;

  } catch (err) {

    console.error("Hybrid RAG error:", err);

    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;
  }
}
