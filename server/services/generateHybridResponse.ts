import { getFusedChunks } from "../services/intentVectorFusion.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { detectIntent, normalize, intents, Intent } from "./intentManager.js";
import { detectService } from "./serviceDetector.js";

/* ================= GEMINI CONFIG ================= */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
const GEMINI_DAILY_LIMIT = 20;
let geminiUsage = { count: 0, lastReset: Date.now() };

function canUseGemini(): boolean {
  if (!GEMINI_ENABLED) return false;
  const now = Date.now();
  const ONE_DAY = 86400000;
  if (now - geminiUsage.lastReset > ONE_DAY) { geminiUsage.count = 0; geminiUsage.lastReset = now; }
  return geminiUsage.count < GEMINI_DAILY_LIMIT;
}
function markGeminiUsed() { geminiUsage.count++; }

/* ================= TIMEOUT ================= */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

/* ================= CONTEXT COMPRESSION ================= */
function compressContext(chunks: any[], maxLength: number = 420): string {
  if (!chunks?.length) return "";
  return chunks
    .map(c => {
      const txt = c?.text?.replace(/\s+/g, " ").trim().slice(0, maxLength);
      return txt ? `• ${txt}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/* ================= FUSED CHUNK RETRIEVAL ================= */
async function getEmbeddingKnowledge(userMessage: string, intentNames: string[]): Promise<{ text: string; count: number }> {
  try {
    const fusedChunks = await getFusedChunks(userMessage, 8); // dynamically fetch more for improved context
    if (!fusedChunks?.length) return { text: "", count: 0 };
    const compressed = compressContext(fusedChunks, 350); // adaptive summarization
    return { text: compressed, count: fusedChunks.length };
  } catch (err) {
    console.error("Fused embedding retrieval error:", err);
    return { text: "", count: 0 };
  }
}

/* ================= REQUEST TYPE ================= */
interface HybridRequest {
  message: string;
  sessionId: string;
  history?: any[];
}

/* ================= SERVICE LIST ================= */
function getRelevantServiceExamples(maxServices = 5): string {
  const services = intents
    .filter(i => i.category === "service")
    .slice(0, maxServices)
    .map(i => `- ${i.name.replace(/_/g, " ")}: ${i.description}`)
    .join("\n");
  return `Relevant Digital Transition Marketing services:\n${services}\n`;
}

/* ================= RESPONSE VALIDATION ================= */
function looksIncomplete(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  return trimmed.length < 80 || ![".", "!", "?"].includes(trimmed.slice(-1));
}

/* ================= MAIN HYBRID SYSTEM ================= */
export async function generateHybridResponse({ message, sessionId, history = [] }: HybridRequest): Promise<string> {
  try {
    const normalizedMessage = normalize(message);
    await memoryService.saveMessage(sessionId, "user", message);

    /* ================= STATIC QUICK RESPONSES ================= */
    const greetings = ["hi", "hello", "hey"];
    const identityQueries = ["who are you", "about yourself"];
    const bookingQueries = ["book", "schedule", "meeting", "call"];

    if (normalizedMessage.length < 15 && greetings.includes(normalizedMessage)) {
      return `Hello. I am ${BOT_NAME}. How can I assist you today?`;
    }
    if (identityQueries.some(q => normalizedMessage.includes(normalize(q)))) {
      return `I am ${BOT_NAME}, AI strategist for Digital Transition Marketing. I help businesses implement advanced AI marketing systems, automation, and digital growth strategies.`;
    }
    if (bookingQueries.some(q => normalizedMessage.includes(q))) {
      return `You can schedule a strategy session here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future`;
    }

    /* ================= MEMORY ================= */
    let historyMessages: any[] = [];
    try { historyMessages = await memoryService.getRecentContext(sessionId); } 
    catch { historyMessages = history.slice(-12); } // more history for better context

    const historyText = historyMessages
      .map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`)
      .join("\n");

    /* ================= INTENT DETECTION ================= */
    let intentMatches: { intent: Intent; score?: number }[] = [];
    try {
      const detected = detectIntent(message);
      if (Array.isArray(detected)) intentMatches = detected as { intent: Intent; score?: number }[];
    } catch { intentMatches = []; }

    const topIntents = intentMatches.slice(0, 3).map(m => m.intent);
    const detectedIntentNames = topIntents.length ? topIntents.map(i => i.name) : ["general"];
    const intentDescriptions = topIntents.map(i => `Intent: ${i.name} — ${i.description}`).join("\n");

    /* ================= SERVICE DETECTION ================= */
    let detectedService: string | null = null;
    try { detectedService = detectService(message); } catch { detectedService = null; }

    /* ================= VECTOR + FUSED KNOWLEDGE ================= */
    const vector = await getEmbeddingKnowledge(message, detectedIntentNames);
    let knowledgePool = "";
    if (vector.text.length > 20) knowledgePool += `Company knowledge:\n${vector.text}\n\n`;
    if (intentDescriptions) knowledgePool += `Intent context:\n${intentDescriptions}\n\n`;
    const serviceExamples = getRelevantServiceExamples(6); // limit for prompt size

    /* ================= PROMPT ================= */
    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing.

Strict rules:
- Only discuss services provided by Digital Transition Marketing.
- Never recommend external tools, platforms, agencies, or products.
- Use ONLY the company knowledge provided.
- Never invent statistics, pricing, guarantees, or contact information.
- Write naturally and professionally.
- Answer directly and stay relevant to the user's question.

Response guidelines:
- Length: 120–220 words maximum.
- If multiple services are relevant, explain them briefly in separate paragraphs.
- Use examples when helpful.
- Avoid repetition.

Detected intents:
${detectedIntentNames.join(", ")}

Detected service focus:
${detectedService ?? "general marketing"}

${knowledgePool}

${serviceExamples}

Conversation history:
${historyText}

User question:
${message}

Write a clear, concise, helpful answer aligned with Digital Transition Marketing services.
`;

    /* ================= MODEL EXECUTION ================= */
    let response = "";
    let modelUsed = "none";
    const MAX_ATTEMPTS = 2;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (process.env.OPENROUTER_API_KEY) {
        const qwenResp = await withTimeout(generateOpenRouter(prompt), 18000);
        if (qwenResp) {
          const cleaned = cleanResponse(qwenResp);
          if (!looksIncomplete(cleaned)) { response = cleaned; modelUsed = "Qwen"; break; }
        }
      }
    }

    /* ================= GEMINI FALLBACK ================= */
    if (!response && canUseGemini()) {
      const geminiResp = await withTimeout(generateGemini(prompt), 12000);
      if (geminiResp) {
        const cleaned = cleanResponse(geminiResp);
        if (!looksIncomplete(cleaned)) { response = cleaned; modelUsed = "Gemini"; markGeminiUsed(); }
      }
    }

    /* ================= HARD FALLBACK ================= */
    if (!response) {
      response = `I am ${BOT_NAME}. I help businesses implement AI-powered marketing systems, automation workflows, predictive analytics, immersive digital experiences, and performance advertising through Digital Transition Marketing.`;
      modelUsed = "fallback";
    }

    response = enforceBotName(response);
    await memoryService.saveMessage(sessionId, "assistant", response);

    console.log(
      `[Hybrid RAG] Model=${modelUsed} | Intents=${detectedIntentNames.join(",")} | Chunks=${vector.count} | Service=${detectedService ?? "none"} | ResponseLen=${response.length}`
    );

    return response;

  } catch (err) {
    console.error("Hybrid RAG error:", err);
    return `I am ${BOT_NAME}. There was a temporary processing issue. Please try again shortly.`;
  }
}
