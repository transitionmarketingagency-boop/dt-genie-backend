// server/services/generateHybridResponse.ts
import { getTopChunks } from "../queryChunks.js";
import { generateOpenRouter } from "./openRouterClient.js";
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
  book: ["book", "schedule", "call"],
};

const greetingVariations = [
  `Hello! How can I assist you today?`,
  `Hi there! Ready to guide your business growth with AI-powered strategies.`,
  `Greetings! Let's explore how to accelerate your business digitally.`,
];

/* ================= SMART JSON INTENTS ================= */
function findMatchingIntent(userMessage: string) {
  const msg = normalize(userMessage);
  const msgWords = msg.split(/\s+/);

  let bestMatch: { score: number; response: string } | null = null;

  for (const intent of aiIntents) {
    if (!intent.triggers || !intent.responses) continue;

    let triggerScore = 0;
    for (const trig of intent.triggers) {
      const trigWords = normalize(trig).split(/\s+/);
      const overlap = trigWords.filter((w) => msgWords.includes(w)).length;
      triggerScore += trigWords.length ? overlap / trigWords.length : 0;
    }

    if (triggerScore > 0.3 && (!bestMatch || triggerScore > bestMatch.score)) {
      bestMatch = {
        score: triggerScore,
        response: intent.responses.join("\n\n"),
      };
    }
  }

  return bestMatch?.response || null;
}

/* ================= EMBEDDING KNOWLEDGE ================= */
async function getEmbeddingKnowledge(userMessage: string) {
  try {
    // Use all pre-embedded chunks, top 12 relevant
    const chunks = await getTopChunks(userMessage, 12, 0.1);
    if (!chunks || chunks.length === 0) return "";
    return chunks.map((c) => c.text).filter(Boolean).join("\n\n");
  } catch (err) {
    console.error("Embedding retrieval error:", err);
    return "";
  }
}

/* ================= MAIN HYBRID RESPONSE ================= */
export async function generateHybridResponse(
  userMessage: string,
  userId = "default-session"
): Promise<string> {
  try {
    await memoryService.addMessage(userId, "user", userMessage);
    const msg = normalize(userMessage);

    /* ===== STATIC GREETING ===== */
    if (staticIntents.greeting.some((t) => msg.includes(normalize(t)))) {
      const r = greetingVariations[Math.floor(Math.random() * greetingVariations.length)];
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== STATIC IDENTITY ===== */
    if (staticIntents.identity.some((t) => msg.includes(normalize(t)))) {
      const r = `I am ${BOT_NAME}, AI Strategist for Digital Transition Marketing. I specialize in AI-driven marketing systems, automation, performance advertising, CGI property marketing, SEO, and scalable digital growth strategies.`;
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== STATIC BOOKING ===== */
    if (staticIntents.book.some((t) => msg.includes(normalize(t)))) {
      const r =
        "You can schedule a strategy call here: https://calendly.com/transition-marketing-agency/let-s-plan-your-digital-future";
      await memoryService.addMessage(userId, "assistant", r);
      return r;
    }

    /* ===== EMBEDDING + INTENT KNOWLEDGE POOL ===== */
    const embeddingKnowledge = await getEmbeddingKnowledge(userMessage);
    const jsonKnowledge = findMatchingIntent(userMessage);

    /* ===== FORCE SERVICE LISTING ===== */
    if (/list.*service/i.test(userMessage)) {
      const forcedKnowledge = await getEmbeddingKnowledge(
        "List all company services with full details and pricing"
      );
      if (forcedKnowledge && forcedKnowledge.length > 50) {
        await memoryService.addMessage(userId, "assistant", forcedKnowledge);
        return formatResponse(null, [{ content: forcedKnowledge }], {});
      }
    }

    let knowledgePool = "";
    if (embeddingKnowledge && embeddingKnowledge.length > 50) knowledgePool += `COMPANY KNOWLEDGE BASE:\n${embeddingKnowledge}\n\n`;
    if (jsonKnowledge) knowledgePool += `SUPPLEMENTAL INTENT DATA:\n${jsonKnowledge}\n\n`;
    if (!knowledgePool) knowledgePool = "Use company domain expertise to answer confidently and professionally.";

    const prompt = `
You are ${BOT_NAME}, AI strategist for Digital Transition Marketing (DTM).

You MUST answer using the company knowledge below.
If pricing, packages, tiers, deliverables, or technical details exist, state them clearly.

Do NOT:
- Say "no direct knowledge match found"
- Say "we don't have that service"
- Speak like a generic consultant
- Over-explain your role

Be direct.
Be confident.
Use structured formatting.
List details clearly.
Provide pricing if available.

${knowledgePool}

User Question:
${userMessage}

Answer:
`;

    let response = "";
    let modelUsed = "None";

    /* ================= PRIMARY: QWEN ================= */
    try {
      response = cleanResponse(await generateOpenRouter(prompt));
      if (response && response.length > 30) modelUsed = "Qwen";
    } catch (err) {
      console.error("Qwen error:", err);
      response = "";
    }

    /* ================= FALLBACK: GEMINI ================= */
    if ((!response || response.length < 30) && canUseGemini()) {
      try {
        const geminiResp = cleanResponse(await generateGemini(prompt));
        if (geminiResp && geminiResp.length > 30) {
          response = geminiResp;
          modelUsed = "Gemini";
          markGeminiUsed();
        }
      } catch (err) {
        console.error("Gemini failed:", err);
      }
    }

    /* ================= ENFORCE BOT NAME ================= */
    if (msg.includes("who are you") || msg.includes("your name")) {
      response = enforceBotName(response);
    }

    /* ================= SAFE FALLBACK ================= */
    if (!response || response.length < 20) {
      response =
        "I can help with AI automation, performance marketing, CGI property tours, SEO systems, and digital growth strategy. Could you specify which area you'd like to explore?";
    }

    await memoryService.addMessage(userId, "assistant", response);

    console.log(`[Hybrid] Model=${modelUsed} | EMB=${!!embeddingKnowledge} | JSON=${!!jsonKnowledge}`);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error:", err);
    return "We’re experiencing a temporary processing issue.";
  }
}
