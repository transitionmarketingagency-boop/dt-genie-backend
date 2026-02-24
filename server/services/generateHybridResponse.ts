// server/services/generateHybridResponse.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getTopChunks } from "../queryChunks.js";
import { generateGemma } from "./gemmaClient.js";
import { generateGemini } from "./geminiClient.js";
import { memoryService } from "./memoryService.js";
import { enforceBotName, BOT_NAME } from "../system/identity.js";
import { cleanResponse } from "../utils/cleanResponse.js";
import { formatResponse } from "../utils/formatResponse.js";

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

/* ================= NORMALIZER ================= */

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/[^\w\s]/gi, "");
}

/* ================= STATIC INTENTS ================= */

const staticIntents = {
  greeting: ["hi", "hello", "hey"],
  identity: ["who are you", "about yourself"],
  tagline: ["tagline", "slogan"],
  targetMarket: ["target market", "who do you serve"],
  mission: ["mission"],
  niches: ["niches", "specialize"]
};

/* ================= STATIC RESPONSES ================= */

const staticMap: Record<string, string> = {
  tagline: "Transitioning your business to the digital age.",
  targetMarket:
    "Ideal clients: • Real Estate Developers & Agencies • Travel & Tourism Agencies • E-commerce Brands",
  mission:
    "Our mission is to empower businesses to dominate the digital future using AI-driven systems, automation, and performance strategy.",
  niches:
    "Specialties: • Real Estate — CGI ads & virtual property tours • Travel & Tourism — AI marketing & automation • E-commerce — scalable growth systems & paid acquisition"
};

/* ================= PERSONA ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const personaPath = path.join(__dirname, "../personas/neon-vision.json");

let systemPersona: any = {
  name: BOT_NAME,
  tone: "professional, strategic, confident"
};

if (fs.existsSync(personaPath)) {
  try {
    systemPersona = JSON.parse(fs.readFileSync(personaPath, "utf-8"));
  } catch {
    console.warn("⚠️ Failed to load persona");
  }
}

/* ================= NON-ANSWER CHECK ================= */

function isWeakResponse(text: string) {
  if (!text) return true;

  const lower = text.toLowerCase();

  if (
    lower.includes("as a large language model") ||
    lower.includes("i am just an ai") ||
    lower.length < 40
  ) {
    return true;
  }

  // prevent CTA-only responses
  if (lower.includes("calendly") && lower.length < 200) {
    return true;
  }

  return false;
}

/* ================= EMBEDDING HELPER ================= */

async function getEmbeddingKnowledge(userMessage: string) {
  try {
    const chunks = await getTopChunks(userMessage, 12, 0.22);
    return chunks.map(c => c.text).join("\n\n");
  } catch {
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

    /* ===== STATIC ROUTING ===== */

    if (staticIntents.greeting.includes(msg)) {
      const response = `Hello! I’m ${BOT_NAME}, your AI strategist at Digital Transition Marketing. How can I assist you today?`;
      await memoryService.addMessage(userId, "assistant", response);
      return response;
    }

    if (staticIntents.identity.some(t => msg.includes(t))) {
      const response = `I am ${BOT_NAME}, your strategic AI system guiding businesses through AI-driven marketing, automation, performance advertising, and digital growth systems.`;
      await memoryService.addMessage(userId, "assistant", response);
      return response;
    }

    for (const key of Object.keys(staticMap)) {
      if (staticIntents[key]?.some(t => msg.includes(t))) {
        const response = staticMap[key];
        await memoryService.addMessage(userId, "assistant", response);
        return response;
      }
    }

    /* ===== EMBEDDINGS + MEMORY ===== */

    const embeddingKnowledge = await getEmbeddingKnowledge(userMessage);
    const history = await memoryService.getHistory(userId);
    const shortHistory = history.slice(-10).map(h => h.content).join("\n");

    const prompt = `
You are ${BOT_NAME}, official AI of Digital Transition Marketing.
Tone: ${systemPersona.tone}.
Never mention AI model.

COMPANY KNOWLEDGE:
${embeddingKnowledge}

RECENT CONTEXT:
${shortHistory}

USER QUESTION:
${userMessage}

Respond with a strategic, structured, expert-level answer.
If services are asked, explain clearly in bullet format.
Do NOT respond with only a booking link.
`;

    let response = cleanResponse(await generateGemma(prompt));
    let modelUsed = "Gemma";

    if (isWeakResponse(response) && canUseGemini()) {
      try {
        response = cleanResponse(await generateGemini(prompt));
        markGeminiUsed();
        modelUsed = "Gemini";
      } catch {}
    }

    response = enforceBotName(response);

    console.log(`[Hybrid] Model=${modelUsed}, Query="${userMessage}"`);

    await memoryService.addMessage(userId, "assistant", response);

    return formatResponse(null, [{ content: response }], {});
  } catch (err) {
    console.error("Hybrid error:", err);
    return "We’re experiencing a temporary issue, but I can still guide you strategically.";
  }
}
