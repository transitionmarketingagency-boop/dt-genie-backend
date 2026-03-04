// server/services/generateHybridResponse.ts
import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "./openRouterClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
import { aiIntents, initializeAIIntents } from "./json_loader.js";

/* ================= INITIALIZE AI INTENTS ================= */
initializeAIIntents();

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
function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

/* ================= STATIC INTENTS ================= */
const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  pricing: ["pricing", "price", "cost", "how much", "package"],
  book: ["book", "schedule", "call"],
};

const greetingVariations = [
  `Hello! How can I assist you today?`,
  `Hi there! Ready to guide your business growth with AI-powered strategies.`,
  `Greetings! Let's explore how to accelerate your business digitally.`,
];

/* ================= SMART JSON INTENTS ================= */
function findMatchingIntent(userMessage: string): string | null {
  const msg = normalize(userMessage);
  const msgWords = msg.split(/\s+/);
  let bestMatch: { score: number; response: string } | null = null;

  for (const intent of aiIntents) {
    if (!intent?.triggers?.length || !intent?.responses?.length) continue;

    let triggerScore = 0;
    for (const trig of intent.triggers) {
      const trigWords = normalize(trig).split(/\s+/);
      const overlap = trigWords.filter((w) => msgWords.includes(w)).length;
      triggerScore += trigWords.length ? overlap / trigWords.length : 0;
    }

    if (triggerScore > 0.3 && (!bestMatch || triggerScore > bestMatch.score)) {
      bestMatch = {
        score: triggerScore,
        response: intent.responses.filter(Boolean).join("\n\n"),
      };
    }
  }

  return bestMatch?.response ?? null;
}

/* ================= EMBEDDING KNOWLEDGE ================= */
async function getEmbeddingKnowledge(userMessage: string): Promise<string> {
  try {
    const chunks = await getTopChunks(userMessage, 12, 0.1);
    if (!chunks?.length) return "";
    const texts = Array.from(new Set(chunks.map((c) => c.text).filter(Boolean)));
    return texts.join("\n\n");
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return "";
  }
}

/* ================= MAIN HYBRID RESPONSE ================= */
interface HybridRequest {
  message: string;
  sessionId: string;
  history?: any[];
  contextChunks?: { text: string; source?: string | null; score?: number }[];
}

export async function generateHybridResponse({
  message,
  sessionId,
  history = [],
  contextChunks = [],
}: HybridRequest): Promise<string> {
  try {
    await memoryService.addMessage(sessionId, "user", message);
    const msg = normalize(message);

    /* ===== STATIC GREETING ===== */
    if (staticIntents.greeting.some((t) => msg.includes(normalize(t)))) {
      const r = greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
      await memoryService.addMessage(sessionId, "assistant", r);
      return r;
    }

    /* ===== STATIC IDENTITY ===== */
    if (staticIntents.identity.some((t) => msg.includes(normalize(t)))) {
      const r = `I am ${BOT_NAME}, AI Strategist for Digital Transition Marketing. I specialize in AI-driven marketing systems, automation, performance advertising, CGI property marketing, SEO systems, and business growth strategies.`;
      await memoryService.addMessage(sessionId, "assistant", r);
      return r;
    }

    /* ===== STATIC BOOKING ===== */
    if (staticIntents.book.some((t) => msg.includes(normalize(t)))) {
      const r =
        "You can schedule a strategy call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
      await memoryService.addMessage(sessionId, "assistant", r);
      return r;
    }

    /* ===== EMBEDDING + INTENT KNOWLEDGE POOL ===== */
    const embeddingKnowledge = await getEmbeddingKnowledge(message);
    const jsonKnowledgeRaw = findMatchingIntent(message);
    const jsonKnowledge = typeof jsonKnowledgeRaw === "string" ? jsonKnowledgeRaw : "";

    let knowledgePool = "";
    if (embeddingKnowledge?.trim().length > 20) {
      knowledgePool += `COMPANY KNOWLEDGE BASE:\n${embeddingKnowledge.trim()}\n\n`;
    }
    if (jsonKnowledge?.trim().length > 20) {
      knowledgePool += `SUPPLEMENTAL INTENT DATA:\n${jsonKnowledge.trim()}\n\n`;
    }

    const promptBase = `You are ${BOT_NAME}, AI strategist for Digital Transition Marketing (DTM).

You MUST answer using the company knowledge below.
If pricing, packages, tiers, deliverables, or technical details exist, state them clearly.

Do NOT:
- Say "no direct knowledge match found"
- Say "we don't have that service"
- Speak like a generic consultant
- Reveal internal reasoning
- Output analysis steps

Be direct.
Be confident.
Use structured formatting.
List details clearly.
Provide pricing if available.

${knowledgePool}

User Question:
${message}

Answer:
`;

    const MIN_RESPONSE_LENGTH = 50;
    let response = "";
    let modelUsed = "None";

    /* ================= QWEN RESPONSE (PRIMARY) ================= */
    try {
      console.log("🔹 Attempting Qwen primary model...");
      const qwenResp = await generateOpenRouter(promptBase);

      if (qwenResp && qwenResp.length >= MIN_RESPONSE_LENGTH) {
        response = cleanResponse(qwenResp);
        modelUsed = "Qwen";
        console.log("✅ Qwen response accepted");
      } else {
        console.warn("⚠️ Qwen returned short or empty response. Fallback may trigger.");
      }
    } catch (err) {
      console.error("❌ Qwen error:", err);
    }

    /* ================= FALLBACK: GEMINI ================= */
    if ((!response || response.length < MIN_RESPONSE_LENGTH) && canUseGemini()) {
      try {
        console.log("🔄 Attempting Gemini fallback...");
        const geminiResp = await generateGemini(promptBase);

        if (geminiResp && geminiResp.length >= MIN_RESPONSE_LENGTH) {
          response = cleanResponse(geminiResp);
          modelUsed = "Gemini";
          markGeminiUsed();
          console.log("✅ Gemini fallback successful");
        } else {
          console.warn("⚠️ Gemini returned short or empty response.");
        }
      } catch (err) {
        console.error("❌ Gemini failed:", err);
      }
    }

    /* ================= ENFORCE BOT NAME ================= */
    response = enforceBotName(response);

    /* ================= SAFE FALLBACK ================= */
    if (!response || response.length < MIN_RESPONSE_LENGTH) {
      response =
        "I can help with AI automation, marketing growth, CGI property tours, SEO systems, and digital strategy. Could you specify which area you'd like to explore?";
      modelUsed = "SafeFallback";
    }

    await memoryService.addMessage(sessionId, "assistant", response);
    console.log(`[Hybrid] Model=${modelUsed} | EMB=${!!embeddingKnowledge} | JSON=${!!jsonKnowledge}`);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error:", err);
    return "We’re experiencing a temporary processing issue.";
  }
}
