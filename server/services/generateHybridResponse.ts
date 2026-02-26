// server/services/generateHybridResponse.ts
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";
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
function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

/* ================= STATIC INTENTS ================= */
const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself", "tell me about yourself"],
  pricing: ["pricing", "price", "cost", "how much", "package"],
  book: ["book", "schedule", "call"]
};

const greetingVariations = [
  `Hello! How can I assist you today?`,
  `Hi there! Ready to guide your business growth with AI-powered strategies.`,
  `Greetings! Let's explore how to accelerate your business digitally.`
];

/* ================= SMART JSON MATCH ================= */
function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);
  let bestMatch: { score: number; response: string } | null = null;

  for (const intent of aiIntents) {
    const triggerScore = intent.triggers.reduce((score: number, trig: string) => {
      const trigNorm = normalize(trig);
      if (msg.includes(trigNorm)) return score + 1;

      const msgWords = msg.split(" ");
      const trigWords = trigNorm.split(" ");
      const overlap = trigWords.filter(w => msgWords.includes(w)).length;
      return score + (overlap / trigWords.length);
    }, 0);

    if (triggerScore > 0.3) {
      if (!bestMatch || triggerScore > bestMatch.score) {
        bestMatch = {
          score: triggerScore,
          response: intent.responses.join("\n\n")
        };
      }
    }
  }

  return bestMatch?.response || null;
}

/* ================= EMBEDDINGS ================= */
async function getEmbeddingKnowledge(userMessage: string) {
  try {
    // LOWERED similarity threshold from 0.15 → 0.05
    const chunks = await getTopChunks(userMessage, 10, 0.05);

    if (!chunks || chunks.length === 0) return "";

    return chunks.map(c => c.text).filter(Boolean).join("\n\n");
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return "";
  }
}

/* ================= MAIN ================= */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);
    const msg = normalize(userMessage);

    /* ===== GREETING ===== */
    if (staticIntents.greeting.includes(msg)) {
      const r = greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== IDENTITY ===== */
    if (staticIntents.identity.some(t => msg.includes(t))) {
      const r = `I am ${BOT_NAME}, AI Strategist for Digital Transition Marketing. I specialize in AI-driven marketing systems, automation, performance advertising, CGI property marketing, and scalable digital growth.`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== BOOKING ===== */
    if (staticIntents.book.some(t => msg.includes(t))) {
      const r = "You can schedule a strategy call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ================= KNOWLEDGE ================= */
    const embeddingKnowledge = await getEmbeddingKnowledge(userMessage);
    const jsonKnowledge = findMatchingIntent(userMessage);

    let knowledgePool = "";
    if (embeddingKnowledge) {
      knowledgePool += `PRIMARY KNOWLEDGE:\n${embeddingKnowledge}\n\n`;
    }
    if (jsonKnowledge) {
      knowledgePool += `SUPPORTING INTENT DATA:\n${jsonKnowledge}\n\n`;
    }

    const hasKnowledge = Boolean(knowledgePool.trim().length > 0);

    /* ================= PROMPT ================= */
    const prompt = `
You are ${BOT_NAME}, senior AI strategist for Digital Transition Marketing.

Use ONLY the provided internal knowledge to answer.
Be specific. Be confident. Be detailed.
Do NOT give generic answers.

Internal Knowledge:
${hasKnowledge ? knowledgePool : "No direct knowledge match found. Use strategic marketing expertise."}

User Question:
${userMessage}
`;

    let response = "";
    let modelUsed = "";

    // Always attempt generation (even without embeddings)
    response = cleanResponse(await generateGemma(prompt));
    modelUsed = "Gemma";

    if ((!response || response.length < 40) && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(prompt));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch (err) {
        console.error("Gemini failed:", err);
      }
    }

    response = enforceBotName(response);

    /* ===== INTELLIGENT FALLBACK (only if model failed completely) ===== */
    if (!response || response.length < 25) {
      response = "I can help with AI automation, performance marketing, CGI property tours, SEO systems, and digital growth strategy. Could you specify which area you’d like to explore?";
    }

    console.log(
      `[Hybrid] Model=${modelUsed} | EMB=${!!embeddingKnowledge} | JSON=${!!jsonKnowledge}`
    );

    await memoryService.addMessage(userId, "assistant", response);
    return formatResponse(null, [{ content: response }], {});

  } catch (err) {
    console.error("Hybrid error:", err);
    return "We’re experiencing a temporary processing issue.";
  }
}
